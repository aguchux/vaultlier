/**
 * Wire format shared with the vaultlier package: lowercase key types
 * ("string" | "boolean" | "number" | "json"), scopes defaulting to ["all"],
 * and the schema document exchanged by `vaultlier pull/push/diff`.
 */

import type { Environment, Key, KeyType, Project } from "@vaultlier/db";

export type WireKeyType = "string" | "boolean" | "number" | "json";

export interface WireKeySchema {
  type: WireKeyType;
  scopes: string[];
}

export interface WireSchema {
  projectId: string;
  version: number;
  environments: string[];
  keys: Record<string, WireKeySchema>;
}

const TO_WIRE: Record<KeyType, WireKeyType> = {
  STRING: "string",
  BOOLEAN: "boolean",
  NUMBER: "number",
  JSON: "json",
};

const FROM_WIRE: Record<WireKeyType, KeyType> = {
  string: "STRING",
  boolean: "BOOLEAN",
  number: "NUMBER",
  json: "JSON",
};

export function toWireType(type: KeyType): WireKeyType {
  return TO_WIRE[type];
}

export function fromWireType(type: string): KeyType | undefined {
  return FROM_WIRE[type as WireKeyType];
}

/** Empty scopes in the DB mean "applies everywhere" — the wire spells it "all". */
export function toWireScopes(scopes: string[]): string[] {
  return scopes.length === 0 ? ["all"] : scopes;
}

export function fromWireScopes(scopes: string[] | undefined): string[] {
  if (!scopes || scopes.includes("all")) return [];
  return scopes;
}

export function buildWireSchema(
  project: Project,
  environments: Environment[],
  keys: Key[],
): WireSchema {
  const wireKeys: Record<string, WireKeySchema> = {};
  for (const key of keys) {
    wireKeys[key.name] = {
      type: toWireType(key.type),
      scopes: toWireScopes(key.scopes),
    };
  }
  return {
    projectId: project.publicId,
    version: project.schemaVersion,
    environments: environments.map((env) => env.name),
    keys: wireKeys,
  };
}

/** Does a key apply to the given environment? */
export function keyInScope(key: Key, environment: string): boolean {
  return key.scopes.length === 0 || key.scopes.includes(environment);
}

/**
 * Parse a stored plaintext into the JSON value the runtime SDK returns,
 * according to the key's declared type.
 */
export function coerceValue(plaintext: string, type: KeyType): unknown {
  switch (type) {
    case "BOOLEAN":
      return plaintext === "true";
    case "NUMBER": {
      const num = Number(plaintext);
      return Number.isNaN(num) ? plaintext : num;
    }
    case "JSON":
      try {
        return JSON.parse(plaintext);
      } catch {
        return plaintext;
      }
    default:
      return plaintext;
  }
}

/**
 * Validate and normalize an incoming secret value for storage under the
 * key's declared type. Returns the plaintext string to seal, or an error.
 */
export function normalizeValue(
  value: unknown,
  type: KeyType,
): { ok: true; plaintext: string } | { ok: false; error: string } {
  switch (type) {
    case "BOOLEAN":
      if (typeof value === "boolean") return { ok: true, plaintext: String(value) };
      if (value === "true" || value === "false") {
        return { ok: true, plaintext: value };
      }
      return { ok: false, error: "expected a boolean" };
    case "NUMBER": {
      if (typeof value === "number" && Number.isFinite(value)) {
        return { ok: true, plaintext: String(value) };
      }
      if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) {
        return { ok: true, plaintext: value };
      }
      return { ok: false, error: "expected a number" };
    }
    case "JSON": {
      if (typeof value === "string") {
        try {
          JSON.parse(value);
          return { ok: true, plaintext: value };
        } catch {
          return { ok: false, error: "expected valid JSON" };
        }
      }
      return { ok: true, plaintext: JSON.stringify(value) };
    }
    default:
      if (typeof value === "string") return { ok: true, plaintext: value };
      return { ok: false, error: "expected a string" };
  }
}
