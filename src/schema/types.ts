/**
 * Shared types for Vaultlier. Imported by the runtime SDK, CLI, and type
 * generator. This module is dependency-free and edge-safe.
 */

/** Supported value types for a vault key. Maps to TypeScript in the generator. */
export type VaultKeyType = "string" | "boolean" | "number" | "json";

/** A scope is an environment name or the literal `"all"`. */
export type VaultScope = "all" | (string & {});

/** Schema definition for a single key, as stored in a Vaultlier config file. */
export interface VaultKeySchema {
  type: VaultKeyType;
  /** Human-readable metadata used in generated key-only .env files. */
  description?: string;
  /** Environments this key applies to. Defaults to `["all"]` when omitted. */
  scopes?: VaultScope[];
  /** Default value for non-secret config. Never used for secret values. */
  default?: string | number | boolean | null;
  /**
   * How this key entered the config. `"scan"` marks a key auto-detected by
   * `vaultlier scan`; such keys are pruned on a later scan if no longer
   * detected. Keys added by hand or via `set` omit this and are never
   * auto-removed.
   */
  source?: "scan";
}

/**
 * The on-disk Vaultlier config shape. Metadata only — never contains
 * decrypted secret values.
 */
export interface VaultlierConfig {
  /** URL of the JSON Schema, for editor validation. Optional, ignored at runtime. */
  $schema?: string;
  projectId: string;
  version: number;
  environments: string[];
  keys: Record<string, VaultKeySchema>;
  /**
   * Where the typed SDK client is generated, relative to the config file.
   * Set by `init` when the user opts into client generation. When omitted,
   * the project manages the SDK by hand and no client file is (re)generated.
   */
  client?: string;
}

/** Canonical hosted JSON Schema for the config file. */
export const CONFIG_SCHEMA_URL =
  "https://schema.vaultlier.com/v2/vaultlier.schema.json";

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
  config: "vaultlier.json",
  /**
   * Default location for the optional typed SDK client. Client generation is
   * opt-in (see `VaultlierConfig.client`); this is the path `init` proposes and
   * the override default for `--output`.
   */
  client: "lib/vaultlier/vaultlier.ts",
} as const;

/** Config filenames accepted by the CLI. The first entry is the write target. */
export const CONFIG_FILES = [
  GENERATED_FILES.config,
  "vaultlier.config.json",
] as const;
