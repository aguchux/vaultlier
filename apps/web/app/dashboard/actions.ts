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
import { generateApiKey, hashApiKey } from "../../lib/api";
import { logAudit } from "../../lib/audit";
import {
  sendApiKeyCreatedEmail,
  sendApiKeyRevokedEmail,
} from "../../lib/email-notifications";
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

export interface CreateApiKeyState {
  rawKey?: string;
  name?: string;
  error?: string;
}

/**
 * Mint a project API key for the CLI/runtime. The raw `vlt_` key is returned
 * to the caller exactly once; only its SHA-256 hash is stored.
 */
export async function createApiKey(
  projectId: string,
  _prev: CreateApiKeyState | null,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    return { error: "Only owners and admins can create API keys." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Key name is required." };
  const keyRole = formData.get("role") === "MEMBER" ? "MEMBER" : "VIEWER";

  const { rawKey, prefix } = generateApiKey();
  await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        projectId,
        name,
        prefix,
        hashedKey: hashApiKey(rawKey),
        role: keyRole,
      },
    });
    await logAudit(
      {
        action: "API_KEY_CREATED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        metadata: { apiKeyId: created.id, name, role: keyRole },
      },
      tx,
    );
  });
  await sendApiKeyCreatedEmail({
    to: user.email,
    projectId,
    projectName: project.name,
    keyName: name,
    keyPrefix: prefix,
    role: keyRole,
  });

  revalidatePath(`/dashboard/${projectId}/settings`);
  return { rawKey, name };
}

export async function revokeApiKey(
  projectId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    throw new Error("Only owners and admins can revoke API keys.");
  }

  const apiKeyId = String(formData.get("apiKeyId") ?? "");
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, projectId, revokedAt: null },
  });
  if (!apiKey) throw new Error("API key not found.");

  await prisma.$transaction(async (tx) => {
    await tx.apiKey.update({
      where: { id: apiKey.id },
      data: { revokedAt: new Date() },
    });
    await logAudit(
      {
        action: "API_KEY_REVOKED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        apiKeyId: apiKey.id,
        metadata: { name: apiKey.name, prefix: apiKey.prefix },
      },
      tx,
    );
  });
  await sendApiKeyRevokedEmail({
    to: user.email,
    projectId,
    projectName: project.name,
    keyName: apiKey.name,
    keyPrefix: apiKey.prefix,
  });

  revalidatePath(`/dashboard/${projectId}/settings`);
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
