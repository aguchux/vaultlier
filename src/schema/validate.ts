import type { VaultKeySchema, VaultKeyType, VaultlierConfig } from "./types.js";

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
 * Validate a parsed Vaultlier config object. Performs structural checks only;
 * it never inspects or expects secret values. Returns a list of human-readable
 * errors rather than throwing, so callers can map to exit codes.
 */
export function validateConfig(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      errors: ["Vaultlier config must be a JSON object"],
    };
  }

  const cfg = input as Partial<VaultlierConfig>;

  if (cfg.$schema !== undefined && typeof cfg.$schema !== "string") {
    errors.push("`$schema` must be a string when present");
  }

  if (typeof cfg.projectId !== "string" || cfg.projectId.length === 0) {
    errors.push("`projectId` is required and must be a non-empty string");
  }

  if (typeof cfg.version !== "number" || !Number.isInteger(cfg.version)) {
    errors.push("`version` is required and must be an integer");
  }

  if (!Array.isArray(cfg.environments) || cfg.environments.length === 0) {
    errors.push("`environments` must contain at least one environment");
  }

  if (cfg.client !== undefined && typeof cfg.client !== "string") {
    errors.push("`client` must be a string when present");
  }

  if (cfg.audit !== undefined) {
    validateAudit(cfg.audit, errors);
  }

  if (typeof cfg.keys !== "object" || cfg.keys === null) {
    errors.push("`keys` must be an object");
  } else {
    for (const [name, schema] of Object.entries(cfg.keys)) {
      validateKey(name, schema, errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateAudit(
  audit: VaultlierConfig["audit"],
  errors: string[],
): void {
  if (typeof audit !== "object" || audit === null) {
    errors.push("`audit` must be an object when present");
    return;
  }

  if (audit.lastRun === undefined) return;
  if (typeof audit.lastRun !== "object" || audit.lastRun === null) {
    errors.push("`audit.lastRun` must be an object when present");
    return;
  }

  if (typeof audit.lastRun.scannedAt !== "string") {
    errors.push("`audit.lastRun.scannedAt` must be a string");
  }
  if (typeof audit.lastRun.reportPath !== "string") {
    errors.push("`audit.lastRun.reportPath` must be a string");
  }
  if (
    typeof audit.lastRun.score !== "number" ||
    audit.lastRun.score < 0 ||
    audit.lastRun.score > 100
  ) {
    errors.push("`audit.lastRun.score` must be a number from 0 to 100");
  }
  if (!Array.isArray(audit.lastRun.findings)) {
    errors.push("`audit.lastRun.findings` must be an array");
  }
  if (!Array.isArray(audit.lastRun.frameworks)) {
    errors.push("`audit.lastRun.frameworks` must be an array");
  }
  if (audit.lastRun.ai !== undefined) {
    if (typeof audit.lastRun.ai !== "object" || audit.lastRun.ai === null) {
      errors.push("`audit.lastRun.ai` must be an object when present");
    } else {
      if (typeof audit.lastRun.ai.summary !== "string") {
        errors.push("`audit.lastRun.ai.summary` must be a string");
      }
      if (!Array.isArray(audit.lastRun.ai.recommendations)) {
        errors.push("`audit.lastRun.ai.recommendations` must be an array");
      }
    }
  }
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
  if (
    schema.description !== undefined &&
    typeof schema.description !== "string"
  ) {
    errors.push(`key "${name}" \`description\` must be a string when present`);
  }
  if (schema.scopes !== undefined && !Array.isArray(schema.scopes)) {
    errors.push(`key "${name}" \`scopes\` must be an array when present`);
  }
}

/** Parse and validate a raw JSON string. Throws on invalid input. */
export function parseConfig(raw: string): VaultlierConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (err) {
    throw new Error(
      `Vaultlier config is not valid JSON: ${(err as Error).message}`,
    );
  }
  const { valid, errors } = validateConfig(parsed);
  if (!valid) {
    throw new Error(`Invalid Vaultlier config:\n - ${errors.join("\n - ")}`);
  }
  return parsed as VaultlierConfig;
}
