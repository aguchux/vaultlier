/**
 * Bring-your-own Postgres storage adapter.
 *
 * Sealed blobs live in a Vaultlier-owned table in the user's database, created
 * on first write. Only ciphertext + AEAD material is stored — no plaintext.
 * Health check is `SELECT 1`. Uses a short-lived `pg` Client per operation so
 * we never hold a pool open against a tenant's database from the request path.
 */

import { Client } from "pg";
import type {
  BlobRef,
  PostgresAdapterConfig,
  SealedBlob,
  StorageAdapter,
  StorageTestResult,
} from "../types";

const TABLE = "vaultlier_secret_blobs";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  project_public_id TEXT NOT NULL,
  environment       TEXT NOT NULL,
  key_name          TEXT NOT NULL,
  version           INTEGER NOT NULL,
  kek_id            TEXT NOT NULL,
  nonce             BYTEA NOT NULL,
  auth_tag          BYTEA NOT NULL,
  ciphertext        BYTEA NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_public_id, environment, key_name, version)
)`;

export class PostgresAdapter implements StorageAdapter {
  readonly type = "POSTGRES" as const;

  constructor(
    private readonly config: PostgresAdapterConfig,
    private readonly projectPublicId: string,
  ) {}

  private async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: this.config.connectionString });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  async put(ref: BlobRef, blob: SealedBlob): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(CREATE_TABLE);
      await client.query(
        `INSERT INTO ${TABLE}
           (project_public_id, environment, key_name, version, kek_id, nonce, auth_tag, ciphertext)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (project_public_id, environment, key_name, version)
         DO UPDATE SET kek_id = EXCLUDED.kek_id, nonce = EXCLUDED.nonce,
                       auth_tag = EXCLUDED.auth_tag, ciphertext = EXCLUDED.ciphertext`,
        [
          this.projectPublicId,
          ref.environment,
          ref.keyName,
          ref.version,
          blob.kekId,
          Buffer.from(blob.nonce),
          Buffer.from(blob.authTag),
          Buffer.from(blob.ciphertext),
        ],
      );
    });
  }

  async get(ref: BlobRef): Promise<SealedBlob | null> {
    return this.withClient(async (client) => {
      const res = await client.query<{
        kek_id: string;
        nonce: Buffer;
        auth_tag: Buffer;
        ciphertext: Buffer;
      }>(
        `SELECT kek_id, nonce, auth_tag, ciphertext FROM ${TABLE}
          WHERE project_public_id = $1 AND environment = $2 AND key_name = $3 AND version = $4`,
        [this.projectPublicId, ref.environment, ref.keyName, ref.version],
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        kekId: row.kek_id,
        nonce: new Uint8Array(row.nonce),
        authTag: new Uint8Array(row.auth_tag),
        ciphertext: new Uint8Array(row.ciphertext),
      };
    }).catch((err: unknown) => {
      // A missing table means nothing was ever written here.
      if (isUndefinedTable(err)) return null;
      throw err;
    });
  }

  async remove(ref: BlobRef): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(
        `DELETE FROM ${TABLE}
          WHERE project_public_id = $1 AND environment = $2 AND key_name = $3`,
        [this.projectPublicId, ref.environment, ref.keyName],
      );
    }).catch((err: unknown) => {
      if (isUndefinedTable(err)) return;
      throw err;
    });
  }

  async test(): Promise<StorageTestResult> {
    try {
      await this.withClient((client) => client.query("SELECT 1"));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }
  }
}

function isUndefinedTable(err: unknown): boolean {
  // Postgres error code 42P01 = undefined_table.
  return (err as { code?: string })?.code === "42P01";
}

function describeError(err: unknown): string {
  const message = (err as { message?: string })?.message;
  return String(message ?? err);
}
