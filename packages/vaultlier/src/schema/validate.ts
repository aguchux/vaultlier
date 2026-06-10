import type {
  VaultKeySchema,
  VaultKeyType,
  VaultlierConfig,
} from "./types.js";

const SUPPORTED_TYPES: readonly VaultKeyType[] = [
  "string",
  "boolean",
  "number",
  "json",
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a parsed `Vaultlier.json` object. Performs structural checks only;
 * it never inspects or expects secret values. Returns a list of human-readable
 * errors rather than throwing, so callers can map to exit codes.
 */
export function validateConfig(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Vaultlier.json must be a JSON object"] };
  }

  const cfg = input as Partial<VaultlierConfig>;

  if (typeof cfg.projectId !== "string" || cfg.projectId.length === 0) {
    errors.push("`projectId` is required and must be a non-empty string");
  }

  if (typeof cfg.version !== "number" || !Number.isInteger(cfg.version)) {
    errors.push("`version` is required and must be an integer");
  }

  if (!Array.isArray(cfg.environments) || cfg.environments.length === 0) {
    errors.push("`environments` must contain at least one environment");
  }

  if (typeof cfg.keys !== "object" || cfg.keys === null) {
    errors.push("`keys` must be an object");
  } else {
    for (const [name, schema] of Object.entries(cfg.keys)) {
      validateKey(name, schema as VaultKeySchema, errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateKey(
  name: string,
  schema: VaultKeySchema | undefined,
  errors: string[],
): void {
  if (typeof schema !== "object" || schema === null) {
    errors.push(`key "${name}" must be an object`);
    return;
  }
  if (!SUPPORTED_TYPES.includes(schema.type)) {
    errors.push(
      `key "${name}" has unsupported type "${String(schema.type)}" ` +
        `(expected one of: ${SUPPORTED_TYPES.join(", ")})`,
    );
  }
  if (schema.scopes !== undefined && !Array.isArray(schema.scopes)) {
    errors.push(`key "${name}" \`scopes\` must be an array when present`);
  }
}

/** Parse and validate a raw JSON string. Throws on invalid input. */
export function parseConfig(raw: string): VaultlierConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Vaultlier.json is not valid JSON: ${(err as Error).message}`,
    );
  }
  const { valid, errors } = validateConfig(parsed);
  if (!valid) {
    throw new Error(`Invalid Vaultlier.json:\n - ${errors.join("\n - ")}`);
  }
  return parsed as VaultlierConfig;
}
