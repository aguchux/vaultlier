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
const SKIPPED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vaultlier",
  "coverage",
  "dist",
  "node_modules",
]);

export interface EnvDiscovery {
  envFiles: string[];
  envFileKeys: string[];
  sourceKeys: string[];
  keys: string[];
}

export interface MergeResult {
  config: VaultlierConfig;
  added: string[];
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

export function mergeKeysIntoConfig(
  config: VaultlierConfig,
  keys: readonly string[],
): MergeResult {
  const nextKeys = { ...config.keys };
  const added: string[] = [];

  for (const key of sortUnique(keys)) {
    if (!ENV_KEY_PATTERN.test(key) || nextKeys[key]) continue;
    nextKeys[key] = { type: "string", scopes: ["all"] };
    added.push(key);
  }

  return {
    config:
      added.length === 0
        ? config
        : {
            ...config,
            version: config.version + 1,
            keys: sortKeySchema(nextKeys),
          },
    added,
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
  await walkSourceFiles(cwd, async (file) => {
    const raw = await readFile(file, "utf8");
    for (const key of parseProcessEnvKeys(raw)) {
      keys.add(key);
    }
  });
  return [...keys].sort();
}

function parseProcessEnvKeys(raw: string): string[] {
  const keys = new Set<string>();
  const dotPattern = /\bprocess\s*\.\s*env\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g;
  const bracketPattern =
    /\bprocess\s*\.\s*env\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g;

  for (const pattern of [dotPattern, bracketPattern]) {
    let match = pattern.exec(raw);
    while (match) {
      keys.add(match[1]!);
      match = pattern.exec(raw);
    }
  }

  return [...keys].sort();
}

async function walkSourceFiles(
  dir: string,
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
      if (!SKIPPED_DIRS.has(entry.name)) {
        await walkSourceFiles(path, visit);
      }
      continue;
    }
    if (!entry.isFile()) continue;

    const info = await stat(path);
    if (info.size > 1_000_000 || !isSourceFile(entry.name)) continue;
    await visit(path);
  }
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
