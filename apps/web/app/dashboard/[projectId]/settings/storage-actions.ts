"use server";

/**
 * Storage backend configuration server actions.
 *
 * A project can store its encrypted secret blobs in the default Vaultlier-
 * managed store (no config row) or in a bring-your-own backend (S3/Postgres).
 * The adapter's credentials are sealed with the project KEK (encryptSecret) —
 * exactly like a secret value — so the DB never holds plaintext credentials,
 * and they are never logged, echoed, or returned to the client.
 *
 * All mutations require an ADMIN+ role, run the adapter's health check before
 * persisting, and audit the change (with non-sensitive metadata only).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@vaultlier/db";
import type { StorageAdapterType } from "@vaultlier/db";
import { logAudit } from "../../../../lib/audit";
import { buildAdapter } from "../../../../lib/storage";
import type {
  AdapterConfig,
  AdapterDisplayMetadata,
  PostgresAdapterConfig,
  S3AdapterConfig,
} from "../../../../lib/storage/types";
import { encryptSecret } from "../../../../lib/vault-crypto";
import { canManageProject } from "../../../../lib/rbac";
import { requireProjectAccess, requireUser } from "../../../../lib/tenancy";

export interface StorageActionState {
  ok?: boolean;
  error?: string;
  tested?: "SUCCESS" | "FAILED";
}

const ADAPTER_TYPES = new Set<StorageAdapterType>(["VAULTLIER", "S3", "POSTGRES"]);

/**
 * Parse + validate the submitted adapter config. Returns the typed config plus
 * the non-sensitive display metadata, or an error message.
 */
function parseConfig(
  adapterType: StorageAdapterType,
  formData: FormData,
):
  | { ok: true; config: AdapterConfig; metadata: AdapterDisplayMetadata }
  | { ok: false; error: string } {
  if (adapterType === "S3") {
    const bucket = String(formData.get("bucket") ?? "").trim();
    const region = String(formData.get("region") ?? "").trim();
    const accessKeyId = String(formData.get("accessKeyId") ?? "").trim();
    const secretAccessKey = String(formData.get("secretAccessKey") ?? "");
    const endpoint = String(formData.get("endpoint") ?? "").trim();
    const prefix = String(formData.get("prefix") ?? "").trim();
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      return {
        ok: false,
        error: "S3 requires bucket, region, access key ID, and secret access key.",
      };
    }
    const config: S3AdapterConfig = {
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      ...(endpoint ? { endpoint } : {}),
      ...(prefix ? { prefix } : {}),
    };
    return {
      ok: true,
      config,
      metadata: {
        adapterType,
        bucket,
        region,
        ...(endpoint ? { endpoint } : {}),
      },
    };
  }
  if (adapterType === "POSTGRES") {
    const connectionString = String(formData.get("connectionString") ?? "").trim();
    if (!connectionString) {
      return { ok: false, error: "Postgres requires a connection string." };
    }
    const config: PostgresAdapterConfig = { connectionString };
    return {
      ok: true,
      config,
      metadata: { adapterType, host: safeHost(connectionString) },
    };
  }
  // VAULTLIER: no external config.
  return { ok: true, config: {} as AdapterConfig, metadata: { adapterType } };
}

/** Extract just the host from a connection string for display (never creds). */
function safeHost(connectionString: string): string | undefined {
  try {
    return new URL(connectionString).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Save the storage backend for a project. Switching to VAULTLIER removes any
 * external config (the DB becomes authoritative again). Non-Vaultlier backends
 * must pass a connection test before they are persisted.
 *
 * Fields: `adapterType` plus adapter-specific credential fields.
 */
export async function configureStorageAdapter(
  projectId: string,
  _prev: StorageActionState | null,
  formData: FormData,
): Promise<StorageActionState> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    return { error: "Only organization owners and admins can configure storage." };
  }

  const adapterType = String(formData.get("adapterType") ?? "") as StorageAdapterType;
  if (!ADAPTER_TYPES.has(adapterType)) {
    return { error: "Choose a valid storage backend." };
  }

  // Switching back to the managed store: drop any external config.
  if (adapterType === "VAULTLIER") {
    await prisma.$transaction(async (tx) => {
      await tx.storageAdapterConfig.deleteMany({ where: { projectId } });
      await logAudit(
        {
          action: "STORAGE_CONFIG_UPDATED",
          userId: user.id,
          organizationId: project.organizationId,
          projectId,
          metadata: { adapterType },
        },
        tx,
      );
    });
    revalidatePath(`/dashboard/${projectId}/settings`);
    return { ok: true };
  }

  const parsed = parseConfig(adapterType, formData);
  if (!parsed.ok) return { error: parsed.error };

  const adapter = buildAdapter(project, adapterType, parsed.config);
  if (!adapter) return { error: "Unsupported storage backend." };
  const test = await adapter.test();
  if (!test.ok) {
    return {
      tested: "FAILED",
      error: `Connection test failed: ${test.error ?? "unreachable"}.`,
    };
  }

  const sealed = encryptSecret(project.id, JSON.stringify(parsed.config));
  await prisma.$transaction(async (tx) => {
    await tx.storageAdapterConfig.upsert({
      where: { projectId },
      update: {
        adapterType,
        ciphertext: new Uint8Array(sealed.ciphertext),
        nonce: new Uint8Array(sealed.nonce),
        authTag: new Uint8Array(sealed.authTag),
        kekId: sealed.kekId,
        metadata: parsed.metadata,
        lastTestedAt: new Date(),
        lastTestStatus: "SUCCESS",
        lastTestError: null,
      },
      create: {
        projectId,
        adapterType,
        ciphertext: new Uint8Array(sealed.ciphertext),
        nonce: new Uint8Array(sealed.nonce),
        authTag: new Uint8Array(sealed.authTag),
        kekId: sealed.kekId,
        metadata: parsed.metadata,
        lastTestedAt: new Date(),
        lastTestStatus: "SUCCESS",
        createdById: user.id,
      },
    });
    await logAudit(
      {
        action: "STORAGE_CONFIG_UPDATED",
        userId: user.id,
        organizationId: project.organizationId,
        projectId,
        metadata: { ...parsed.metadata, tested: "SUCCESS" },
      },
      tx,
    );
  });

  revalidatePath(`/dashboard/${projectId}/settings`);
  return { ok: true, tested: "SUCCESS" };
}

/**
 * Test connectivity with the submitted credentials without saving. Lets an
 * admin verify config before committing.
 */
export async function testStorageAdapter(
  projectId: string,
  _prev: StorageActionState | null,
  formData: FormData,
): Promise<StorageActionState> {
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  if (!canManageProject(role)) {
    return { error: "Only organization owners and admins can test storage." };
  }

  const adapterType = String(formData.get("adapterType") ?? "") as StorageAdapterType;
  if (adapterType === "VAULTLIER") {
    return { ok: true, tested: "SUCCESS" };
  }
  if (!ADAPTER_TYPES.has(adapterType)) {
    return { error: "Choose a valid storage backend." };
  }

  const parsed = parseConfig(adapterType, formData);
  if (!parsed.ok) return { error: parsed.error };

  const adapter = buildAdapter(project, adapterType, parsed.config);
  if (!adapter) return { error: "Unsupported storage backend." };
  const test = await adapter.test();

  await logAudit({
    action: "STORAGE_CONFIG_TESTED",
    userId: user.id,
    organizationId: project.organizationId,
    projectId,
    metadata: { ...parsed.metadata, tested: test.ok ? "SUCCESS" : "FAILED" },
  });

  if (!test.ok) {
    return {
      tested: "FAILED",
      error: `Connection test failed: ${test.error ?? "unreachable"}.`,
    };
  }
  return { ok: true, tested: "SUCCESS" };
}
