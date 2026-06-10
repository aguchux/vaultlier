/**
 * Shared types for Vaultlier. Imported by the runtime SDK, CLI, and type
 * generator. This module is dependency-free and edge-safe.
 */

/** Supported value types for a vault key. Maps to TypeScript in the generator. */
export type VaultKeyType = "string" | "boolean" | "number" | "json";

/** A scope is an environment name or the literal `"all"`. */
export type VaultScope = "all" | (string & {});

/** Schema definition for a single key, as stored in `Vaultlier.json`. */
export interface VaultKeySchema {
  type: VaultKeyType;
  /** Environments this key applies to. Defaults to `["all"]` when omitted. */
  scopes?: VaultScope[];
  /** Default value for non-secret config. Never used for secret values. */
  default?: string | number | boolean | null;
}

/**
 * The on-disk `Vaultlier.json` shape. Metadata only — never contains
 * decrypted secret values.
 */
export interface VaultlierConfig {
  projectId: string;
  version: number;
  environments: string[];
  keys: Record<string, VaultKeySchema>;
}

/** Standard error shape returned by the API and surfaced by clients. */
export interface VaultlierError {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

/** CLI exit codes. */
export const ExitCode = {
  Success: 0,
  GenericError: 1,
  AuthFailed: 2,
  SchemaInvalid: 3,
  Conflict: 4,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/** Runtime environment variable that holds the API key. */
export const API_KEY_ENV = "VAULTLIER_API_KEY";

/** Names of the generated artifacts written by the CLI. */
export const GENERATED_FILES = {
  config: "Vaultlier.json",
  client: "lib/Vaultlier.ts",
} as const;
