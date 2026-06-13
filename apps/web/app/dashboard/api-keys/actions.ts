"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { logAudit } from "../../../lib/audit";
import {
  sendApiKeyCreatedEmail,
  sendApiKeyRevokedEmail,
} from "../../../lib/email-notifications";
import {
  canManageProject,
  requireProjectAccess,
  requireUser,
} from "../../../lib/tenancy";

export interface CreateProjectApiKeyState {
  rawKey?: string;
  name?: string;
  error?: string;
}

function mintApiKey(): { rawKey: string; prefix: string; hashedKey: string } {
  const rawKey = `vlt_live_${randomBytes(24).toString("hex")}`;
  return {
    rawKey,
    prefix: rawKey.slice(0, 13),
    hashedKey: createHash("sha256").update(rawKey, "utf8").digest("hex"),
  };
}

export async function createProjectApiKey(
  projectId: string,
  _previous: CreateProjectApiKeyState | null,
  formData: FormData,
): Promise<CreateProjectApiKeyState> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    return {
      error: "Only organization owners and admins can create API keys.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Key name is required." };
  const keyRole = formData.get("role") === "MEMBER" ? "MEMBER" : "VIEWER";
  const { rawKey, prefix, hashedKey } = mintApiKey();

  await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        projectId,
        name,
        prefix,
        hashedKey,
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

  revalidatePath("/dashboard/api-keys");
  return { rawKey, name };
}

export async function revokeProjectApiKey(
  projectId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    throw new Error("Only organization owners and admins can revoke API keys.");
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
  revalidatePath("/dashboard/api-keys");
}
