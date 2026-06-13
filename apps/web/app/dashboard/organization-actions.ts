"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import type { Role } from "@repo/db";
import { logAudit } from "../../lib/audit";
import { canInviteRole } from "../../lib/rbac";
import { organizationDeletionBlockers } from "../../lib/resource-policy";
import {
  canManageOrganization,
  canManageRole,
  requireOrganizationAccess,
  requireUser,
  slugify,
} from "../../lib/tenancy";

const MEMBER_ROLES = new Set<Role>(["ADMIN", "MEMBER", "VIEWER"]);
const INVITE_TTL_DAYS = 14;

function readDescription(formData: FormData): string | null {
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 500) {
    throw new Error("Organization description cannot exceed 500 characters.");
  }
  return description || null;
}

function readRole(value: FormDataEntryValue | null): Role {
  const role = String(value ?? "MEMBER") as Role;
  return MEMBER_ROLES.has(role) ? role : "MEMBER";
}

function revalidateOrganization(organizationId: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/overview");
  revalidatePath("/dashboard/organizations");
  revalidatePath("/dashboard/environments");
  revalidatePath("/dashboard/audit");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/dashboard?organizationId=${organizationId}`);
}

export async function createOrganization(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = readDescription(formData);
  if (name.length < 2 || name.length > 80) {
    throw new Error("Organization name must be between 2 and 80 characters.");
  }

  const slug = `${slugify(name)}-${randomBytes(3).toString("hex")}`;
  const organization = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name,
        description,
        slug,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    await logAudit(
      {
        action: "ORGANIZATION_CREATED",
        userId: user.id,
        organizationId: created.id,
        metadata: { name, slug, hasDescription: Boolean(description) },
      },
      tx,
    );
    return created;
  });

  revalidateOrganization(organization.id);
  redirect(`/dashboard?organizationId=${organization.id}`);
}

export async function renameOrganization(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { organization, role } = await requireOrganizationAccess(
    user.id,
    organizationId,
  );
  if (!canManageOrganization(role)) {
    throw new Error("Only owners and admins can update this organization.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = readDescription(formData);
  if (name.length < 2 || name.length > 80) {
    throw new Error("Organization name must be between 2 and 80 characters.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: { name, description },
    });
    await logAudit(
      {
        action: "ORGANIZATION_UPDATED",
        userId: user.id,
        organizationId,
        metadata: {
          from: organization.name,
          to: name,
          descriptionUpdated: organization.description !== description,
        },
      },
      tx,
    );
  });
  revalidateOrganization(organizationId);
}

export async function deleteOrganization(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { organization, role } = await requireOrganizationAccess(
    user.id,
    organizationId,
  );
  if (role !== "OWNER") {
    throw new Error("Only the organization owner can delete an organization.");
  }
  const confirmation = String(formData.get("confirmation") ?? "");
  if (confirmation !== organization.name) {
    throw new Error("Organization name confirmation did not match.");
  }

  const [projectCount, memberCount, pendingInvitationCount] = await Promise.all(
    [
      prisma.project.count({ where: { organizationId } }),
      prisma.membership.count({ where: { organizationId } }),
      prisma.organizationInvitation.count({
        where: { organizationId, acceptedAt: null },
      }),
    ],
  );
  const blockers = organizationDeletionBlockers({
    projectCount,
    memberCount,
    pendingInvitationCount,
  });
  if (blockers.length > 0) {
    throw new Error(
      `This organization cannot be deleted while it has ${blockers.join(", ")}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await logAudit(
      {
        action: "ORGANIZATION_DELETED",
        userId: user.id,
        organizationId,
        metadata: { organizationId, name: organization.name },
      },
      tx,
    );
    await tx.organization.delete({ where: { id: organizationId } });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/organizations");
  redirect("/dashboard/organizations");
}

export async function inviteOrganizationMember(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  const { role: actorRole } = await requireOrganizationAccess(
    actor.id,
    organizationId,
  );
  if (!canManageOrganization(actorRole)) {
    throw new Error("Only owners and admins can invite members.");
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = readRole(formData.get("role"));
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email.");
  if (!canInviteRole(actorRole, role)) {
    throw new Error("You cannot invite a member with that role.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$transaction(async (tx) => {
    if (existingUser) {
      const existingMembership = await tx.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId,
          },
        },
      });
      if (existingMembership) throw new Error("This user is already a member.");
      await tx.membership.create({
        data: { userId: existingUser.id, organizationId, role },
      });
    } else {
      await tx.organizationInvitation.upsert({
        where: { organizationId_email: { organizationId, email } },
        update: {
          role,
          invitedById: actor.id,
          expiresAt,
          acceptedAt: null,
        },
        create: {
          organizationId,
          email,
          role,
          invitedById: actor.id,
          expiresAt,
        },
      });
    }
    await logAudit(
      {
        action: "MEMBER_INVITED",
        userId: actor.id,
        organizationId,
        metadata: {
          email,
          role,
          status: existingUser ? "added" : "pending",
        },
      },
      tx,
    );
  });
  revalidateOrganization(organizationId);
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  const { role: actorRole } = await requireOrganizationAccess(
    actor.id,
    organizationId,
  );
  const membershipId = String(formData.get("membershipId") ?? "");
  const nextRole = readRole(formData.get("role"));
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { user: { select: { email: true } } },
  });
  if (!membership) throw new Error("Organization member not found.");
  if (!canManageRole(actorRole, membership.role, nextRole)) {
    throw new Error("You cannot assign that organization role.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: { role: nextRole },
    });
    await logAudit(
      {
        action: "MEMBER_ROLE_UPDATED",
        userId: actor.id,
        organizationId,
        metadata: {
          email: membership.user.email,
          from: membership.role,
          to: nextRole,
        },
      },
      tx,
    );
  });
  revalidateOrganization(organizationId);
}

export async function removeOrganizationMember(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  const { role: actorRole } = await requireOrganizationAccess(
    actor.id,
    organizationId,
  );
  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { user: { select: { email: true } } },
  });
  if (!membership) throw new Error("Organization member not found.");
  if (!canManageRole(actorRole, membership.role)) {
    throw new Error("You cannot remove this organization member.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: membership.id } });
    await logAudit(
      {
        action: "MEMBER_REMOVED",
        userId: actor.id,
        organizationId,
        metadata: { email: membership.user.email, role: membership.role },
      },
      tx,
    );
  });
  revalidateOrganization(organizationId);
}

export async function revokeOrganizationInvitation(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  const { role: actorRole } = await requireOrganizationAccess(
    actor.id,
    organizationId,
  );
  if (!canManageOrganization(actorRole)) {
    throw new Error("Only owners and admins can revoke invitations.");
  }
  const invitationId = String(formData.get("invitationId") ?? "");
  const invitation = await prisma.organizationInvitation.findFirst({
    where: { id: invitationId, organizationId, acceptedAt: null },
  });
  if (!invitation) throw new Error("Invitation not found.");
  if (actorRole === "ADMIN" && invitation.role === "ADMIN") {
    throw new Error("Only owners can revoke an admin invitation.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationInvitation.delete({ where: { id: invitation.id } });
    await logAudit(
      {
        action: "INVITATION_REVOKED",
        userId: actor.id,
        organizationId,
        metadata: { email: invitation.email, role: invitation.role },
      },
      tx,
    );
  });
  revalidateOrganization(organizationId);
}
