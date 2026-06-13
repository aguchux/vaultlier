/**
 * Multi-tenancy helpers for the portal.
 *
 * Every dashboard read/write goes through these guards so a user can only
 * ever see or mutate projects in organizations they belong to.
 */

import { randomBytes } from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@repo/db";
import type { Role } from "@repo/db";
import { auth } from "./auth";
import { logAudit } from "./audit";

export { canManageOrganization, canManageProject, canManageRole } from "./rbac";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

/** Resolve the signed-in user or redirect to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) {
    redirect("/login");
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}

/**
 * Organizations the user belongs to, with their projects. Creates a personal
 * organization on first visit so new users always land somewhere.
 */
export async function getUserOrgs(user: SessionUser) {
  const orgs = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: "asc" },
    include: {
      memberships: { where: { userId: user.id }, select: { role: true } },
      projects: { orderBy: { createdAt: "asc" } },
    },
  });
  if (orgs.length > 0) return orgs;

  await createPersonalOrg(user);
  return getUserOrgs(user);
}

async function createPersonalOrg(user: SessionUser): Promise<void> {
  const base = slugify(user.name ?? user.email.split("@")[0] ?? "personal");
  const slug = `${base}-${randomBytes(3).toString("hex")}`;
  const name = user.name ? `${user.name}'s Org` : "Personal";

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        slug,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    await logAudit(
      {
        action: "ORGANIZATION_CREATED",
        userId: user.id,
        organizationId: org.id,
        metadata: { slug, name },
      },
      tx,
    );
  });
}

/**
 * Load a project the user has access to, plus their role in its organization.
 * 404s when the project doesn't exist or belongs to another tenant.
 */
export async function requireProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { memberships: { some: { userId } } },
    },
    include: {
      organization: {
        include: {
          memberships: { where: { userId }, select: { role: true } },
        },
      },
    },
  });
  if (!project) notFound();
  const role: Role = project.organization.memberships[0]?.role ?? "VIEWER";
  return { project, role };
}

/** Resolve an organization membership or hide the tenant with a 404. */
export async function requireOrganizationAccess(
  userId: string,
  organizationId: string,
) {
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      memberships: { some: { userId } },
    },
    include: {
      memberships: { where: { userId }, select: { role: true } },
    },
  });
  if (!organization) notFound();
  const role: Role = organization.memberships[0]?.role ?? "VIEWER";
  return { organization, role };
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "personal"
  );
}
