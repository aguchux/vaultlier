import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VaultlierConfig } from "../schema/types.js";

const ENV_FILE_PATTERN = /^\.env(?:\.|$)/;
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".svelte",
  ".ts",
  ".tsx",
  ".vue",
]);
/**
 * Directories never scanned for env keys: VCS, tooling caches, and common
 * compiled/build output. Output dirs hold generated JS that re-references the
 * same env vars as their source, so scanning them adds nothing and risks
 * picking up bundled third-party code. Project-specific output dirs (e.g. a
 * tsconfig `outDir`) are resolved on top of this at scan time.
 */
const SKIPPED_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".vaultlier",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "output",
]);

export interface EnvDiscovery {
  envFiles: string[];
  envFileKeys: string[];
  sourceKeys: string[];
  keys: string[];
}

export async function discoverEnvMetadata(cwd: string): Promise<EnvDiscovery> {
  const [envFileResult, sourceKeys] = await Promise.all([
    discoverEnvFileKeys(cwd),
    discoverSourceEnvKeys(cwd),
  ]);
  const keys = sortUnique([...envFileResult.keys, ...sourceKeys]);

  return {
    envFiles: envFileResult.files,
    envFileKeys: envFileResult.keys,
    sourceKeys,
    keys,
  };
}

export function parseEnvKeyNames(raw: string): string[] {
  const keys = new Set<string>();

  for (const rawLine of raw.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trimStart();
    }

    const separator = line.indexOf("=");
    const key = (separator === -1 ? line : line.slice(0, separator)).trim();
    if (ENV_KEY_PATTERN.test(key)) {
      keys.add(key);
    }
  }

  return [...keys].sort();
}

export interface MergeResult {
  config: VaultlierConfig;
  added: string[];
  removed: string[];
}

export function mergeKeysIntoConfig(
  config: VaultlierConfig,
  keys: readonly string[],
): MergeResult {
  const detected = new Set(keys.filter((key) => ENV_KEY_PATTERN.test(key)));
  const nextKeys = { ...config.keys };
  const added: string[] = [];
  const removed: string[] = [];

  for (const key of [...detected].sort()) {
    if (nextKeys[key]) continue;
    // New keys are tagged so a later scan can prune them if the code stops
    // referencing them, without ever touching hand-/`set`-managed keys.
    nextKeys[key] = { type: "string", scopes: ["all"], source: "scan" };
    added.push(key);
  }

  // Self-correct: drop previously scan-added keys that no longer appear in any
  // source or .env file. Keys without `source: "scan"` are user-managed and
  // left untouched.
  for (const [name, schema] of Object.entries(nextKeys)) {
    if (schema.source === "scan" && !detected.has(name)) {
      delete nextKeys[name];
      removed.push(name);
    }
  }

  const changed = added.length > 0 || removed.length > 0;
  return {
    config: changed
      ? {
          ...config,
          version: config.version + 1,
          keys: sortKeySchema(nextKeys),
        }
      : config,
    added,
    removed: removed.sort(),
  };
}

export function generateEnvFile(config: VaultlierConfig, env?: string): string {
  const lines: string[] = [];

  for (const [name, schema] of Object.entries(sortKeySchema(config.keys))) {
    const scopes = schema.scopes ?? ["all"];
    if (env && !scopes.includes("all") && !scopes.includes(env)) continue;

    if (schema.description) {
      for (const line of schema.description.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) lines.push(`# ${trimmed}`);
      }
    }
    lines.push(`${name}=`);
    lines.push("");
  }

  return lines.length === 0 ? "" : `${lines.join("\n").trimEnd()}\n`;
}

export async function writeEnvFile(path: string, contents: string): Promise<void> {
  await writeFile(path, contents, "utf8");
}

async function discoverEnvFileKeys(
  cwd: string,
): Promise<{ files: string[]; keys: string[] }> {
  let entries;
  try {
    entries = await readdir(cwd, { withFileTypes: true });
  } catch {
    return { files: [], keys: [] };
  }

  const files = entries
    .filter((entry) => entry.isFile() && ENV_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const keys = new Set<string>();

  for (const file of files) {
    const raw = await readFile(join(cwd, file), "utf8");
    for (const key of parseEnvKeyNames(raw)) {
      keys.add(key);
    }
  }

  return { files, keys: [...keys].sort() };
}

async function discoverSourceEnvKeys(cwd: string): Promise<string[]> {
  const keys = new Set<string>();
  const skipDirs = await resolveSkippedDirs(cwd);
  await walkSourceFiles(cwd, skipDirs, async (file) => {
    const raw = await readFile(file, "utf8");
    for (const key of parseSourceEnvKeys(raw)) {
      keys.add(key);
    }
  });
  return [...keys].sort();
}

/**
 * Built-in `import.meta.env` members that frameworks (Vite, Astro, SvelteKit)
 * expose but which are not user-defined environment variables. Vite only
 * surfaces *user* env vars under the `VITE_`/`PUBLIC_` prefixes, so we keep
 * those and drop the built-ins here.
 */
const IMPORT_META_ENV_BUILTINS = new Set([
  "MODE",
  "BASE_URL",
  "PROD",
  "DEV",
  "SSR",
]);

/**
 * Extract environment-variable names from a source file. Only recognizes
 * established env-access idioms so generic SCREAMING_SNAKE constants (e.g. a
 * local `const THIS_TYPE_OF_VAR = ...`) are never mistaken for env vars:
 *
 *  - `process.env.X` / `process.env["X"]`        (Node.js, Next.js)
 *  - `Deno.env.get("X")`                          (Deno)
 *  - `import.meta.env.X`                          (Vite/Astro/SvelteKit; built-ins dropped)
 *  - `configService.get("X")` / `config.get("X")` (NestJS @nestjs/config)
 *  - `env("X")` / `getenv("X")`                   (generic config helpers)
 */
function parseSourceEnvKeys(raw: string): string[] {
  const keys = new Set<string>();
  const ident = "[A-Za-z_][A-Za-z0-9_]*";

  // process.env.X and process.env["X"] / ['X']
  const processDot = new RegExp(`\\bprocess\\s*\\.\\s*env\\s*\\.\\s*(${ident})`, "g");
  const processBracket = new RegExp(
    `\\bprocess\\s*\\.\\s*env\\s*\\[\\s*["'\`](${ident})["'\`]\\s*\\]`,
    "g",
  );
  // Deno.env.get("X")
  const denoGet = new RegExp(
    `\\bDeno\\s*\\.\\s*env\\s*\\.\\s*get\\s*\\(\\s*["'\`](${ident})["'\`]`,
    "g",
  );
  // configService.get("X") / config.get<T>("X") / this.config.get("X")
  // Anchored to a `config`-named receiver so it only matches config accessors.
  const configGet = new RegExp(
    `\\bconfig(?:Service)?\\s*\\.\\s*get\\s*(?:<[^>]*>)?\\s*\\(\\s*["'\`](${ident})["'\`]`,
    "gi",
  );
  // env("X") / getenv("X") helper calls.
  const envHelper = new RegExp(
    `\\b(?:get)?env\\s*\\(\\s*["'\`](${ident})["'\`]`,
    "g",
  );

  for (const pattern of [
    processDot,
    processBracket,
    denoGet,
    configGet,
    envHelper,
  ]) {
    let match = pattern.exec(raw);
    while (match) {
      keys.add(match[1]!);
      match = pattern.exec(raw);
    }
  }

  // import.meta.env.X — keep only user-defined (prefixed) vars, drop built-ins.
  const importMetaEnv = new RegExp(
    `\\bimport\\s*\\.\\s*meta\\s*\\.\\s*env\\s*\\.\\s*(${ident})`,
    "g",
  );
  let metaMatch = importMetaEnv.exec(raw);
  while (metaMatch) {
    const name = metaMatch[1]!;
    if (!IMPORT_META_ENV_BUILTINS.has(name)) {
      keys.add(name);
    }
    metaMatch = importMetaEnv.exec(raw);
  }

  return [...keys].sort();
}

async function walkSourceFiles(
  dir: string,
  skipDirs: ReadonlySet<string>,
  visit: (path: string) => Promise<void>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        await walkSourceFiles(path, skipDirs, visit);
      }
      continue;
    }
    if (!entry.isFile()) continue;

    const info = await stat(path);
    if (info.size > 1_000_000 || !isSourceFile(entry.name)) continue;
    await visit(path);
  }
}

/**
 * Build the set of directory names to skip, combining the built-in defaults
 * with any compiled-output dir declared in a project `tsconfig.json`
 * (`compilerOptions.outDir`). Only the top path segment is used (e.g. an
 * `outDir` of `./build/server` contributes `build`), matching how the walk
 * compares directory names.
 */
async function resolveSkippedDirs(cwd: string): Promise<ReadonlySet<string>> {
  const dirs = new Set(SKIPPED_DIRS);
  for (const file of ["tsconfig.json", "tsconfig.build.json"]) {
    const segment = await readTsconfigOutDir(join(cwd, file));
    if (segment) dirs.add(segment);
  }
  return dirs;
}

/**
 * Read `compilerOptions.outDir` from a tsconfig and return its first path
 * segment, or null if absent/unreadable. Tolerates trailing commas and `//`
 * comments common in tsconfig files via a targeted regex rather than a full
 * JSONC parser (keeping the package dependency-free).
 */
async function readTsconfigOutDir(path: string): Promise<string | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }
  const match = /"outDir"\s*:\s*"([^"]+)"/.exec(raw);
  if (!match) return null;
  const segment = match[1]!
    .replace(/^\.\/?/, "")
    .split(/[\\/]/)
    .find((part) => part && part !== ".");
  return segment ?? null;
}

function isSourceFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && SOURCE_EXTENSIONS.has(name.slice(dot));
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sortKeySchema(
  keys: VaultlierConfig["keys"],
): VaultlierConfig["keys"] {
  return Object.fromEntries(Object.entries(keys).sort(([a], [b]) => a.localeCompare(b)));
}
