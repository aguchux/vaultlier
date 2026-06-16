/**
 * Storage backend seam.
 *
 * Every secret value is persisted as an opaque sealed blob
 * ({ ciphertext, nonce, authTag, kekId }) — encryption already happened in the
 * vault layer, so an adapter never sees plaintext or holds key material. An
 * adapter only puts/gets/removes that blob keyed by (environment, keyName,
 * version). This lets a project store its values in Vaultlier's own DB
 * (default) or in a bring-your-own backend (S3, Postgres) without changing the
 * encryption or access-control story.
 */

import type { StorageAdapterType } from "@repo/db";

/** Opaque encrypted payload. Byte fields use Uint8Array for Prisma `Bytes`. */
export interface SealedBlob {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  authTag: Uint8Array;
  kekId: string;
}

/** Addresses one value: a key name in one environment at one version. */
export interface BlobRef {
  environment: string;
  keyName: string;
  version: number;
}

export interface StorageTestResult {
  ok: boolean;
  error?: string;
}

export interface StorageAdapter {
  readonly type: StorageAdapterType;
  /** Persist a sealed blob. Throws on failure (callers handle fallback). */
  put(ref: BlobRef, blob: SealedBlob): Promise<void>;
  /** Fetch a sealed blob, or null when absent. */
  get(ref: BlobRef): Promise<SealedBlob | null>;
  /** Remove a value (best-effort; missing is not an error). */
  remove(ref: BlobRef): Promise<void>;
  /** Health/connectivity check used before saving config and on demand. */
  test(): Promise<StorageTestResult>;
}

/** Adapter-specific configuration shapes (the sealed JSON payload). */
export interface S3AdapterConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional custom endpoint for S3-compatible stores (R2, MinIO). */
  endpoint?: string;
  /** Key prefix inside the bucket; defaults to "vaultlier". */
  prefix?: string;
  /** Force path-style addressing (required by MinIO). */
  forcePathStyle?: boolean;
}

export interface PostgresAdapterConfig {
  connectionString: string;
}

export type AdapterConfig = S3AdapterConfig | PostgresAdapterConfig;

/** Non-sensitive fields safe to store/display in metadata and audit logs. */
export interface AdapterDisplayMetadata {
  // Index signature so this is assignable to Prisma's JSON input type.
  [key: string]: string | undefined;
  adapterType: StorageAdapterType;
  bucket?: string;
  region?: string;
  endpoint?: string;
  host?: string;
}
