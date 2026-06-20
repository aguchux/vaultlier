import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverEnvMetadata,
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

const tempDirs: string[] = [];

async function makeProject(
  files: Record<string, string>,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vaultlier-env-"));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(dir, name), contents, "utf8");
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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

describe("discoverEnvMetadata", () => {
  it("detects established env idioms and ignores bare constants", async () => {
    const cwd = await makeProject({
      "node.ts":
        "const x = process.env.NODE_KEY; const y = process.env['BRACKET_KEY'];\n",
      "deno.ts": "Deno.env.get('DENO_KEY');\n",
      "vite.ts":
        "const a = import.meta.env.VITE_API_URL; const b = import.meta.env.MODE;\n",
      "nest.ts":
        "this.configService.get<number>('NEST_PORT'); config.get('NEST_HOST');\n",
      "helper.ts": "env('HELPER_KEY'); getenv('GETENV_KEY');\n",
      // A plain SCREAMING_SNAKE constant must NOT be picked up.
      "noise.ts":
        "const THIS_TYPE_OF_VAR = 42; export const ANOTHER_CONST = 'x';\n",
    });

    const { sourceKeys } = await discoverEnvMetadata(cwd);

    expect(sourceKeys).toEqual([
      "BRACKET_KEY",
      "DENO_KEY",
      "GETENV_KEY",
      "HELPER_KEY",
      "NEST_HOST",
      "NEST_PORT",
      "NODE_KEY",
      "VITE_API_URL",
    ]);
    // import.meta.env built-ins and bare constants are excluded.
    expect(sourceKeys).not.toContain("MODE");
    expect(sourceKeys).not.toContain("THIS_TYPE_OF_VAR");
    expect(sourceKeys).not.toContain("ANOTHER_CONST");
  });

  it("skips built/compiled output directories", async () => {
    const cwd = await makeProject({
      "src.ts": "process.env.SRC_KEY;\n",
    });
    const { mkdir } = await import("node:fs/promises");
    for (const outDir of ["dist", "out", "output", "build", ".next"]) {
      await mkdir(join(cwd, outDir), { recursive: true });
      await writeFile(
        join(cwd, outDir, "bundle.js"),
        "process.env.COMPILED_ONLY_KEY;\n",
        "utf8",
      );
    }

    const { sourceKeys } = await discoverEnvMetadata(cwd);

    expect(sourceKeys).toEqual(["SRC_KEY"]);
    expect(sourceKeys).not.toContain("COMPILED_ONLY_KEY");
  });

  it("skips a tsconfig-declared outDir", async () => {
    const cwd = await makeProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { outDir: "./lib-out" },
      }),
      "src.ts": "process.env.SRC_KEY;\n",
    });
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(cwd, "lib-out"), { recursive: true });
    await writeFile(
      join(cwd, "lib-out", "compiled.js"),
      "process.env.OUTDIR_KEY;\n",
      "utf8",
    );

    const { sourceKeys } = await discoverEnvMetadata(cwd);

    expect(sourceKeys).toEqual(["SRC_KEY"]);
    expect(sourceKeys).not.toContain("OUTDIR_KEY");
  });
});

describe("mergeKeysIntoConfig", () => {
  it("adds detected keys tagged with source: scan", () => {
    const result = mergeKeysIntoConfig(config, [
      "DATABASE_URL",
      "FEATURE_NEW_FLOW",
    ]);

    expect(result.added).toEqual(["FEATURE_NEW_FLOW"]);
    expect(result.removed).toEqual([]);
    expect(result.config.version).toBe(2);
    expect(result.config.keys.FEATURE_NEW_FLOW).toEqual({
      type: "string",
      scopes: ["all"],
      source: "scan",
    });
  });

  it("prunes scan-added keys that are no longer detected", () => {
    const withScanKey: VaultlierConfig = {
      ...config,
      keys: {
        ...config.keys,
        OLD_SCANNED: { type: "string", scopes: ["all"], source: "scan" },
      },
    };

    // DATABASE_URL still detected; OLD_SCANNED is not.
    const result = mergeKeysIntoConfig(withScanKey, ["DATABASE_URL"]);

    expect(result.removed).toEqual(["OLD_SCANNED"]);
    expect(result.config.keys.OLD_SCANNED).toBeUndefined();
    expect(result.config.keys.DATABASE_URL).toBeDefined();
  });

  it("never prunes user-managed keys (no source tag)", () => {
    // No keys detected at all; existing keys are user-managed.
    const result = mergeKeysIntoConfig(config, []);

    expect(result.removed).toEqual([]);
    expect(result.config).toBe(config);
    expect(result.config.keys.DATABASE_URL).toBeDefined();
    expect(result.config.keys.STRIPE_SECRET).toBeDefined();
  });

  it("ignores non-conforming key names", () => {
    const result = mergeKeysIntoConfig(config, ["123BAD", "with-dash"]);
    expect(result.added).toEqual([]);
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
