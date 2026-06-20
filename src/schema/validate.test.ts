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

  it("accepts key descriptions as metadata", () => {
    expect(
      validateConfig({
        ...valid,
        keys: {
          DATABASE_URL: {
            type: "string",
            scopes: ["all"],
            description: "Database connection string",
          },
        },
      }).valid,
    ).toBe(true);
  });

  it("accepts audit summary metadata", () => {
    expect(
      validateConfig({
        ...valid,
        audit: {
          lastRun: {
            toolVersion: 1,
            scannedAt: "2026-06-20T00:00:00.000Z",
            reportPath: "vaultlier-audit-report.html",
            score: 88,
            categories: {
              structure: { score: 100, findings: 0 },
              exposedSecrets: { score: 70, findings: 1 },
              dependencies: { score: 100, findings: 0 },
              framework: { score: 100, findings: 0 },
            },
            findings: [],
            frameworks: ["Next.js"],
            ai: {
              provider: "deepseek",
              model: "deepseek-chat",
              summary: "No critical issues.",
              recommendations: ["Keep scanning in CI."],
            },
          },
        },
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

  it("rejects non-string key descriptions", () => {
    const { valid: ok, errors } = validateConfig({
      ...valid,
      keys: { BAD: { type: "string", description: 42 } },
    });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/description/);
  });

  it("rejects invalid audit summary scores", () => {
    const { valid: ok, errors } = validateConfig({
      ...valid,
      audit: { lastRun: { score: 101 } },
    });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/audit\.lastRun\.score/);
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
