import { describe, expect, it } from "vitest";
import { parseConfig, validateConfig } from "./validate.js";

const valid = {
  projectId: "prj_checkout_api",
  version: 1,
  environments: ["dev", "prod"],
  keys: {
    DATABASE_URL: { type: "string", scopes: ["all"] },
  },
};

describe("validateConfig", () => {
  it("accepts a well-formed config", () => {
    expect(validateConfig(valid).valid).toBe(true);
  });

  it("accepts a string $schema reference", () => {
    expect(
      validateConfig({
        $schema: "https://schema.vaultlier.com/v2/vaultlier.schema.json",
        ...valid,
      }).valid,
    ).toBe(true);
  });

  it("rejects a non-string $schema reference", () => {
    const { valid: ok, errors } = validateConfig({
      $schema: 42,
      ...valid,
    });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/\$schema/);
  });

  it("requires projectId", () => {
    const { valid: ok, errors } = validateConfig({ ...valid, projectId: "" });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/projectId/);
  });

  it("requires at least one environment", () => {
    const { valid: ok } = validateConfig({ ...valid, environments: [] });
    expect(ok).toBe(false);
  });

  it("rejects unsupported key types", () => {
    const { valid: ok, errors } = validateConfig({
      ...valid,
      keys: { BAD: { type: "date" } },
    });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/unsupported type/);
  });
});

describe("parseConfig", () => {
  it("throws on invalid JSON", () => {
    expect(() => parseConfig("{ not json")).toThrow(/not valid JSON/);
  });

  it("throws on schema violations", () => {
    expect(() => parseConfig(JSON.stringify({ version: 1 }))).toThrow(
      /Invalid Vaultlier config/,
    );
  });

  it("returns the parsed config when valid", () => {
    expect(parseConfig(JSON.stringify(valid)).projectId).toBe(
      "prj_checkout_api",
    );
  });

  it("accepts a leading UTF-8 BOM", () => {
    expect(parseConfig(`\uFEFF${JSON.stringify(valid)}`).projectId).toBe(
      "prj_checkout_api",
    );
  });
});
