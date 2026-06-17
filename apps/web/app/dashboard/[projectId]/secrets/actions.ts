"use server";

/**
 * Server actions for the in-portal environment-variable editor.
 *
 * A "variable" is a schema Key (name + type, project-scoped) plus an encrypted
 * KeyVersion per environment. Setting a value creates the Key on first use and
 * appends a new immutable version; deleting removes that environment's versions
 * for the key. All writes require a MEMBER+ role, are validated against the
 * key's declared type, and are audited inside the same transaction.
 *
 * Plaintext is sealed before storage and never persisted or echoed back.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@vaultlier/db";
import type { KeyType } from "@vaultlier/db";
import { logAudit } from "../../../../lib/audit";
import { encryptSecret, isVaultConfigured } from "../../../../lib/vault-crypto";
import { removeSealed, writeSealed } from "../../../../lib/storage";
import { fromWireType, normalizeValue } from "../../../../lib/vault-wire";
import { canWriteSecrets } from "../../../../lib/rbac";
import { requireProjectAccess, requireUser } from "../../../../lib/tenancy";

const KEY_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_VALUE_LENGTH = 32 * 1024;

export interface SecretActionState {
  ok?: boolean;
  error?: string;
}

/**
 * Create or update one variable's value in a single environment.
 *
 * Fields: `environmentId`, `name`, `value`, `type` (string|boolean|number|json),
 * and `isNew` ("1" when creating a brand-new key vs. updating an existing one).
 */
export async function setSecret(
  projectId: string,
  _prev: SecretActionState | null,
  formData: FormData,
): Promise<SecretActionState> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canWriteSecrets(role)) {
    return { error: "Your role can't change secret values." };
  }
  if (!isVaultConfigured()) {
    return {
      error:
        "Vault not configured: set VAULT_MASTER_KEY on the server (vaultlier generate-key) before saving secrets.",
    };
  }

  const environmentId = String(formData.get("environmentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const rawValue = String(formData.get("value") ?? "");
  const wireType = String(formData.get("type") ?? "string");

  if (!KEY_NAME_PATTERN.test(name)) {
    return {
      error:
        "Key names must start with a letter or underscore and use only letters, numbers, and underscores.",
    };
  }
  const type = fromWireType(wireType);
  if (!type) return { error: `Unknown type "${wireType}".` };

  const normalized = normalizeValue(rawValue, type);
  if (!normalized.ok) return { error: `Value: ${normalized.error}.` };
  if (normalized.plaintext.length > MAX_VALUE_LENGTH) {
    return { error: `Value exceeds ${MAX_VALUE_LENGTH} bytes.` };
  }

  const environment = await prisma.environment.findFirst({
    where: { id: environmentId, projectId },
  });
  if (!environment) return { error: "Unknown environment." };

  try {
    await prisma.$transaction(async (tx) => {
      // Upsert the schema key. A new key applies to all environments (empty
      // scopes) so it can hold a value here and elsewhere.
      const key = await tx.key.upsert({
        where: { projectId_name: { projectId, name } },
        update: {},
        create: { projectId, name, type: type as KeyType, scopes: [] },
      });

      const created = !(await tx.keyVersion.findFirst({
        where: { keyId: key.id },
        select: { id: true },
      }));
      if (created) {
        await logAudit(
          {
            action: "KEY_CREATED",
            userId: user.id,
            organizationId: project.organizationId,
            projectId,
            metadata: { name, type: wireType, source: "portal" },
          },
          tx,
        );
      }

      const latest = await tx.keyVersion.findFirst({
        where: { keyId: key.id, environmentId: environment.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      const sealed = encryptSecret(project.id, normalized.plaintext);
      // Prisma's Bytes type rejects Buffer's ArrayBufferLike backing.
      const blob = {
        ciphertext: new Uint8Array(sealed.ciphertext),
        nonce: new Uint8Array(sealed.nonce),
        authTag: new Uint8Array(sealed.authTag),
        kekId: sealed.kekId,
      };
      // Push to the project's external store (if any) before recording the DB
      // fallback copy; drift is flagged when the external write fails.
      const { needsResync } = await writeSealed(
        project,
        { environment: environment.name, keyName: name, version },
        blob,
      );
      await tx.keyVersion.create({
        data: {
          keyId: key.id,
          environmentId: environment.id,
          version,
          ciphertext: blob.ciphertext,
          nonce: blob.nonce,
          authTag: blob.authTag,
          kekId: blob.kekId,
          needsResync,
        },
      });
      if (needsResync) {
        await logAudit(
          {
            action: "STORAGE_SYNC_FAILED",
            userId: user.id,
            organizationId: project.organizationId,
            projectId,
            environment: environment.name,
            metadata: { keys: [name], source: "portal" },
          },
          tx,
        );
      }
      await logAudit(
        {
          action: "SECRET_WRITTEN",
          userId: user.id,
          organizationId: project.organizationId,
          projectId,
          environment: environment.name,
          metadata: { keys: [name], source: "portal" },
        },
        tx,
      );
    });
  } catch {
    return { error: "Could not save the value. Please try again." };
  }

  revalidatePath(`/dashboard/${projectId}/secrets`);
  return { ok: true };
}

/**
 * Delete a variable's value in one environment (removes that environment's
 * versions for the key). The schema key itself stays — manage keys/scopes via
 * the CLI or the environments page.
 *
 * Fields: `environmentId`, `keyId`.
 */
export async function deleteSecret(
  projectId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canWriteSecrets(role)) {
    throw new Error("Your role can't change secret values.");
  }

  const environmentId = String(formData.get("environmentId") ?? "");
  const keyId = String(formData.get("keyId") ?? "");

  const key = await prisma.key.findFirst({
    where: { id: keyId, projectId },
    select: { id: true, name: true },
  });
  const environment = await prisma.environment.findFirst({
    where: { id: environmentId, projectId },
    select: { id: true, name: true },
  });
  if (!key || !environment) throw new Error("Variable not found.");

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.keyVersion.deleteMany({
      where: { keyId: key.id, environmentId: environment.id },
    });
    if (count === 0) return;
    await logAudit(
      {
        action: "SECRET_DELETED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        environment: environment.name,
        metadata: { keys: [key.name], source: "portal" },
      },
      tx,
    );
  });

  // Best-effort removal from the external store; the DB delete above is
  // authoritative for what the runtime serves.
  await removeSealed(project, {
    environment: environment.name,
    keyName: key.name,
  });

  revalidatePath(`/dashboard/${projectId}/secrets`);
}
