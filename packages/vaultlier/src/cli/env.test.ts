import { describe, expect, it } from "vitest";
import {
  generateEnvFile,
  mergeKeysIntoConfig,
  parseEnvKeyNames,
} from "./env.js";
import type { VaultlierConfig } from "../schema/types.js";

const config: VaultlierConfig = {
  projectId: "prj_checkout_api",
  version: 1,
  environments: ["dev", "prod"],
  keys: {
    DATABASE_URL: {
      type: "string",
      scopes: ["all"],
      description: "Database connection string",
    },
    STRIPE_SECRET: {
      type: "string",
      scopes: ["prod"],
      description: "Stripe secret key",
    },
  },
};

describe("parseEnvKeyNames", () => {
  it("extracts keys and drops values", () => {
    const keys = parseEnvKeyNames(`
DATABASE_URL=postgres://user:pass@example.com/db
export STRIPE_SECRET=sk_test_secret
# COMMENTED_SECRET=secret
FEATURE_FLAG=true
`);

    expect(keys).toEqual(["DATABASE_URL", "FEATURE_FLAG", "STRIPE_SECRET"]);
    expect(keys.join("\n")).not.toContain("sk_test_secret");
    expect(keys.join("\n")).not.toContain("postgres://");
  });
});

describe("mergeKeysIntoConfig", () => {
  it("adds detected keys as string metadata only", () => {
    const result = mergeKeysIntoConfig(config, [
      "DATABASE_URL",
      "FEATURE_NEW_FLOW",
    ]);

    expect(result.added).toEqual(["FEATURE_NEW_FLOW"]);
    expect(result.config.version).toBe(2);
    expect(result.config.keys.FEATURE_NEW_FLOW).toEqual({
      type: "string",
      scopes: ["all"],
    });
  });
});

describe("generateEnvFile", () => {
  it("writes key-only env output with description comments", () => {
    const out = generateEnvFile(config, "prod");

    expect(out).toContain("# Database connection string\nDATABASE_URL=");
    expect(out).toContain("# Stripe secret key\nSTRIPE_SECRET=");
    expect(out).not.toContain("sk_test");
    expect(out).not.toContain("postgres://");
  });

  it("filters by environment scopes", () => {
    const out = generateEnvFile(config, "dev");

    expect(out).toContain("DATABASE_URL=");
    expect(out).not.toContain("STRIPE_SECRET");
  });
});
