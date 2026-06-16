/**
 * Storage backend factory + write/read orchestration.
 *
 * `getExternalAdapter` resolves a project's configured bring-your-own backend
 * (S3/Postgres), or null when the project uses the default Vaultlier-managed
 * store. Encryption happens in the vault layer before anything reaches here, so
 * adapters only ever move opaque sealed blobs.
 *
 * The Vaultlier DB is ALWAYS the fallback copy: `writeSealed` reports whether
 * the external put succeeded so the caller can flag drift (`needsResync`) on
 * the DB row, and `readExternal` lets readers prefer the external store and
 * fall back to the DB row on miss/outage.
 */

import { prisma } from "@repo/db";
import type { Project, StorageAdapterConfig } from "@repo/db";
import { decryptSecret } from "../vault-crypto";
import type {
  AdapterConfig,
  BlobRef,
  PostgresAdapterConfig,
  S3AdapterConfig,
  SealedBlob,
  StorageAdapter,
} from "./types";
import { S3Adapter } from "./adapters/s3";
import { PostgresAdapter } from "./adapters/postgres";

/** Minimal project shape the storage layer needs. */
export interface StorageProject {
  id: string;
  publicId: string;
}

/** Decrypt the sealed adapter-config JSON for a project. */
function decryptConfig(
  project: StorageProject,
  config: StorageAdapterConfig,
): AdapterConfig {
  const json = decryptSecret(project.id, {
    ciphertext: Buffer.from(config.ciphertext),
    nonce: Buffer.from(config.nonce),
    authTag: Buffer.from(config.authTag),
    kekId: config.kekId,
  });
  return JSON.parse(json) as AdapterConfig;
}

/** Build an adapter instance from a decrypted config + project. */
export function buildAdapter(
  project: StorageProject,
  adapterType: StorageAdapterConfig["adapterType"],
  config: AdapterConfig,
): StorageAdapter | null {
  switch (adapterType) {
    case "S3":
      return new S3Adapter(config as S3AdapterConfig, project.publicId);
    case "POSTGRES":
      return new PostgresAdapter(config as PostgresAdapterConfig, project.publicId);
    default:
      return null; // VAULTLIER: no external adapter — DB is authoritative.
  }
}

/**
 * Resolve the external adapter configured for a project, or null when the
 * project uses the default Vaultlier-managed store.
 */
export async function getExternalAdapter(
  project: StorageProject,
): Promise<StorageAdapter | null> {
  const config = await prisma.storageAdapterConfig.findUnique({
    where: { projectId: project.id },
  });
  if (!config || config.adapterType === "VAULTLIER") return null;
  return buildAdapter(project, config.adapterType, decryptConfig(project, config));
}

/**
 * Push a sealed blob to the project's external store, if any. Returns whether
 * the value needs resync: true when an external store is configured but the
 * write failed (the caller still persists the DB fallback and flags the row);
 * false when there is no external store or the write succeeded.
 */
export async function writeSealed(
  project: StorageProject,
  ref: BlobRef,
  blob: SealedBlob,
): Promise<{ needsResync: boolean }> {
  const adapter = await getExternalAdapter(project);
  if (!adapter) return { needsResync: false };
  try {
    await adapter.put(ref, blob);
    return { needsResync: false };
  } catch {
    // Availability over strictness: the DB fallback copy is written by the
    // caller; we only signal that the external store is behind.
    return { needsResync: true };
  }
}

/** Best-effort delete from the external store (the DB rows are removed by the caller). */
export async function removeSealed(
  project: StorageProject,
  ref: Pick<BlobRef, "environment" | "keyName"> & { version?: number },
): Promise<void> {
  const adapter = await getExternalAdapter(project);
  if (!adapter) return;
  try {
    await adapter.remove({ version: 0, ...ref });
  } catch {
    // Ignore: the authoritative removal is the DB delete; stale external
    // objects are harmless (reads always go through the DB key list).
  }
}

/**
 * Read a sealed blob from the external store, or null to tell the caller to
 * use its DB fallback row. Never throws: an external outage degrades to the
 * DB copy rather than failing the read.
 */
export async function readExternal(
  project: StorageProject,
  ref: BlobRef,
): Promise<SealedBlob | null> {
  const adapter = await getExternalAdapter(project);
  if (!adapter) return null;
  try {
    return await adapter.get(ref);
  } catch {
    return null;
  }
}

export type { StorageAdapter } from "./types";
export type ProjectForStorage = Pick<Project, "id" | "publicId">;
