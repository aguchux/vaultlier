"use server";

/**
 * Dashboard server actions. All mutations:
 *  1. verify the caller's membership/role in the project's organization,
 *  2. run inside a transaction together with their AuditLog entry.
 */

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { logAudit } from "../../lib/audit";
import {
  canManageProject,
  requireProjectAccess,
  requireUser,
} from "../../lib/tenancy";

const DEFAULT_ENVIRONMENTS = ["dev", "staging", "prod"];

export async function createProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!organizationId || !name) {
    throw new Error("Project name is required.");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });
  if (!membership || membership.role === "VIEWER") {
    throw new Error("You don't have permission to create projects here.");
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        organizationId,
        name,
        publicId: `prj_${randomBytes(8).toString("hex")}`,
        environments: {
          create: DEFAULT_ENVIRONMENTS.map((env) => ({ name: env })),
        },
      },
    });
    await logAudit(
      {
        action: "PROJECT_CREATED",
        userId: user.id,
        organizationId,
        projectId: created.id,
        metadata: { name, publicId: created.publicId },
      },
      tx,
    );
    return created;
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/${project.id}`);
}

export async function renameProject(
  projectId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Project name is required.");
  }

  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    throw new Error("Only owners and admins can rename a project.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { name } });
    await logAudit(
      {
        action: "PROJECT_UPDATED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        metadata: { from: project.name, to: name },
      },
      tx,
    );
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${projectId}`);
}

export async function deleteProject(projectId: string): Promise<void> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    throw new Error("Only owners and admins can destroy a project.");
  }

  await prisma.$transaction(async (tx) => {
    // The project row is about to go away, so identify it via metadata
    // instead of the (SetNull) projectId relation.
    await logAudit(
      {
        action: "PROJECT_DELETED",
        userId: user.id,
        organizationId: project.organizationId,
        metadata: {
          projectId: project.id,
          publicId: project.publicId,
          name: project.name,
        },
      },
      tx,
    );
    await tx.project.delete({ where: { id: projectId } });
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
