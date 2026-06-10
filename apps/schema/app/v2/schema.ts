/**
 * Canonical JSON Schema for the Vaultlier config file
 * (`vaultlier.json` / `vaultlier.config.json`).
 *
 * Served at https://schema.vaultlier.com/v2/vaultlier.schema.json and used as
 * the `$schema` reference inside a project's config. This mirrors the
 * `VaultlierConfig` type and the `validateConfig` rules in the `vaultlier`
 * package. Metadata only — secret values are never stored in the config.
 */

export const SCHEMA_VERSION = "v2";

export const SCHEMA_ID =
  "https://schema.vaultlier.com/v2/vaultlier.schema.json";

export const vaultlierConfigSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SCHEMA_ID,
  title: "Vaultlier Config",
  description:
    "Schema metadata for a Vaultlier project. Stored in vaultlier.json or " +
    "vaultlier.config.json. Contains project ID, version, environments, and " +
    "key schema only — never decrypted secret values.",
  type: "object",
  additionalProperties: false,
  required: ["projectId", "version", "environments", "keys"],
  properties: {
    $schema: {
      type: "string",
      description: "URL of this schema, for editor validation.",
      format: "uri",
    },
    projectId: {
      type: "string",
      description: "The project identifier issued by the Vaultlier portal.",
      minLength: 1,
      examples: ["prj_checkout_api"],
    },
    version: {
      type: "integer",
      description: "Schema revision. Incremented on each successful push.",
      minimum: 1,
    },
    environments: {
      type: "array",
      description: "Environments defined for this project.",
      minItems: 1,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
      },
      examples: [["dev", "staging", "prod"]],
    },
    keys: {
      type: "object",
      description: "Map of key name to its schema. Values are never stored.",
      additionalProperties: { $ref: "#/$defs/key" },
    },
  },
  $defs: {
    key: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: {
          description: "Value type. Maps to a TypeScript type in the client.",
          enum: ["string", "boolean", "number", "json"],
        },
        scopes: {
          type: "array",
          description:
            'Environments this key applies to, or "all". Defaults to ["all"].',
          items: { type: "string", minLength: 1 },
          uniqueItems: true,
        },
        default: {
          description:
            "Default value for non-secret config. Never used for secrets.",
          type: ["string", "number", "boolean", "null"],
        },
      },
    },
  },
} as const;
