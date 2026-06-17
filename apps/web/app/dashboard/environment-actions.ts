"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@vaultlier/db";
import { logAudit } from "../../lib/audit";
import {
  environmentDeletionBlockers,
  isValidEnvironmentName,
  normalizeEnvironmentName,
  replaceEnvironmentScope,
} from "../../lib/resource-policy";
import {
  canManageProject,
  requireProjectAccess,
  requireUser,
} from "../../lib/tenancy";

function readEnvironmentName(formData: FormData): string {
  const name = normalizeEnvironmentName(String(formData.get("name") ?? ""));
  if (!isValidEnvironmentName(name)) {
    throw new Error(
      "Environment names must start with a letter and contain only lowercase letters, numbers, hyphens, or underscores (maximum 32 characters).",
    );
  }
  return name;
}

function revalidateEnvironments(projectId: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/environments");
  revalidatePath(`/dashboard/${projectId}`);
}

export async function createEnvironment(
  projectId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    throw new Error(
      "Only organization owners and admins can add environments.",
    );
  }
  const name = readEnvironmentName(formData);
  const exists = await prisma.environment.findUnique({
    where: { projectId_name: { projectId, name } },
  });
  if (exists) throw new Error(`The ${name} environment already exists.`);

  await prisma.$transaction(async (tx) => {
    await tx.environment.create({ data: { projectId, name } });
    await tx.project.update({
      where: { id: projectId },
      data: { schemaVersion: { increment: 1 } },
    });
    await logAudit(
      {
        action: "ENVIRONMENT_CREATED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        environment: name,
        metadata: { name },
      },
      tx,
    );
  });
  revalidateEnvironments(projectId);
}

export async function updateEnvironment(
  projectId: string,
  environmentId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    throw new Error(
      "Only organization owners and admins can rename environments.",
    );
  }
  const environment = await prisma.environment.findFirst({
    where: { id: environmentId, projectId },
  });
  if (!environment) throw new Error("Environment not found.");
  const name = readEnvironmentName(formData);
  if (name === environment.name) return;
  const exists = await prisma.environment.findUnique({
    where: { projectId_name: { projectId, name } },
  });
  if (exists) throw new Error(`The ${name} environment already exists.`);

  await prisma.$transaction(async (tx) => {
    const scopedKeys = await tx.key.findMany({
      where: { projectId, scopes: { has: environment.name } },
      select: { id: true, scopes: true },
    });
    await Promise.all(
      scopedKeys.map((key) =>
        tx.key.update({
          where: { id: key.id },
          data: {
            scopes: replaceEnvironmentScope(key.scopes, environment.name, name),
          },
        }),
      ),
    );
    await tx.environment.update({
      where: { id: environment.id },
      data: { name },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { schemaVersion: { increment: 1 } },
    });
    await logAudit(
      {
        action: "ENVIRONMENT_UPDATED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        environment: name,
        metadata: {
          from: environment.name,
          to: name,
          updatedScopeCount: scopedKeys.length,
        },
      },
      tx,
    );
  });
  revalidateEnvironments(projectId);
}

export async function deleteEnvironment(
  projectId: string,
  environmentId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    throw new Error(
      "Only organization owners and admins can delete environments.",
    );
  }
  const environment = await prisma.environment.findFirst({
    where: { id: environmentId, projectId },
  });
  if (!environment) throw new Error("Environment not found.");
  const confirmation = normalizeEnvironmentName(
    String(formData.get("confirmation") ?? ""),
  );
  if (confirmation !== environment.name) {
    throw new Error("Environment name confirmation did not match.");
  }

  await prisma.$transaction(async (tx) => {
    const [keyVersionCount, scopedKeyCount] = await Promise.all([
      tx.keyVersion.count({ where: { environmentId } }),
      tx.key.count({ where: { projectId, scopes: { has: environment.name } } }),
    ]);
    const blockers = environmentDeletionBlockers({
      keyVersionCount,
      scopedKeyCount,
    });
    if (blockers.length > 0) {
      throw new Error(
        `This environment cannot be deleted while it has ${blockers.join(", ")}.`,
      );
    }

    await logAudit(
      {
        action: "ENVIRONMENT_DELETED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        environment: environment.name,
        metadata: { environmentId, name: environment.name },
      },
      tx,
    );
    await tx.environment.delete({ where: { id: environment.id } });
    await tx.project.update({
      where: { id: projectId },
      data: { schemaVersion: { increment: 1 } },
    });
  });
  revalidateEnvironments(projectId);
}
