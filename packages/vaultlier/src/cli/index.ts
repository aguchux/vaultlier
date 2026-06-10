/**
 * Vaultlier CLI core. Node-only. Command dispatch lives here; the executable
 * shim is `bin.ts`.
 *
 * Commands: init, pull, push, diff, whoami.
 * All commands return a numeric exit code (see ExitCode).
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { generateClient } from "../generator/index.js";
import {
  API_KEY_ENV,
  CONFIG_FILES,
  CONFIG_SCHEMA_URL,
  ExitCode,
  GENERATED_FILES,
} from "../schema/types.js";
import type { VaultlierConfig } from "../schema/types.js";
import { looksLikeApiKey, maskSecret } from "../schema/security.js";
import { parseConfig, validateConfig } from "../schema/validate.js";
import { DEV_HOST, DEV_PORT, buildSnapshot, startDevServer } from "./dev.js";

export type CommandName = "init" | "pull" | "push" | "diff" | "whoami" | "dev";

export interface ParsedArgs {
  command?: string;
  env?: string;
  flags: Record<string, string | boolean>;
}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdin?: NodeJS.ReadableStream;
  stdout?: Pick<NodeJS.WritableStream, "write">;
  stderr?: Pick<NodeJS.WritableStream, "write">;
  installer?: Installer;
}

interface CliContext {
  cwd: string;
  env: Record<string, string | undefined>;
  stdin: NodeJS.ReadableStream;
  stdout: Pick<NodeJS.WritableStream, "write">;
  stderr: Pick<NodeJS.WritableStream, "write">;
  installer: Installer;
}

interface CredentialCache {
  projectId: string;
  apiKey: string;
}

interface InstallCommand {
  command: string;
  args: string[];
}

type Installer = (params: {
  cwd: string;
  command: string;
  args: string[];
}) => Promise<number>;

const VALUE_FLAGS = new Set([
  "api-key",
  "apiKey",
  "env",
  "environments",
  "host",
  "port",
  "project-id",
  "projectId",
]);

/** Parse `argv` (without `node` and script path) into a command + flags. */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=", 2);
      if (!key) continue;
      if (value !== undefined) {
        flags[key] = value;
        continue;
      }

      const next = argv[i + 1];
      if (VALUE_FLAGS.has(key) && next && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else if (command === undefined) {
      command = arg;
    }
  }

  const env = typeof flags.env === "string" ? flags.env : undefined;
  return { command, env, flags };
}

/** Mask an API key for safe display: keep prefix, hide the rest. */
export function maskApiKey(apiKey: string): string {
  return maskSecret(apiKey);
}

const HELP = `vaultlier - sealed configuration vault CLI

Usage:
  vaultlier <command> [options]

Commands:
  init                 Authenticate and write vaultlier.json + lib/Vaultlier.ts
  pull --env=<name>    Fetch schema metadata and regenerate the typed client
  push --env=<name>    Push local schema additions to the portal
  diff --env=<name>    Show schema differences between local and portal
  whoami               Print the authenticated project context
  dev                  Start the local config UI (metadata only) on port ${DEV_PORT}

Options:
  --project-id=<id>    Project ID used by init
  --api-key=<key>      API key used by init; cached locally, never in generated files
  --env=<name|all>     Target environment
  --environments=a,b   Initial environment list for init
  --port=<n>           Port for vaultlier dev (default ${DEV_PORT})
  --host=<addr>        Host for vaultlier dev (default ${DEV_HOST}, loopback only)
  --install            Install vaultlier dependency without prompting
  --no-install         Skip dependency install prompt
  --force              Allow init to overwrite existing config metadata
  --help               Show this help
`;

/** Run the CLI. Returns an exit code. */
export async function run(
  argv: string[],
  options: RunOptions = {},
): Promise<ExitCode> {
  const { command, flags } = parseArgs(argv);
  const ctx: CliContext = {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    stdin: options.stdin ?? processStdin,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
    installer: options.installer ?? installPackage,
  };

  if (!command || flags.help) {
    ctx.stdout.write(HELP);
    return ExitCode.Success;
  }

  switch (command as CommandName) {
    case "init":
      return initCommand(flags, ctx);
    case "pull":
      return pullCommand(flags, ctx);
    case "push":
      return portalCommand("push", flags, ctx);
    case "diff":
      return portalCommand("diff", flags, ctx);
    case "whoami":
      return whoamiCommand(ctx);
    case "dev":
      return devCommand(flags, ctx);
    default:
      ctx.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return ExitCode.GenericError;
  }
}

async function initCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const projectId = await resolveTextInput({
    flags,
    names: ["project-id", "projectId"],
    prompt: "projectId: ",
    ctx,
  });
  const apiKey = await resolveTextInput({
    flags,
    names: ["api-key", "apiKey"],
    prompt: "apiKey: ",
    ctx,
    fallback: ctx.env[API_KEY_ENV],
  });

  if (!projectId) {
    ctx.stderr.write("vaultlier init: missing projectId\n");
    return ExitCode.SchemaInvalid;
  }
  if (!apiKey) {
    ctx.stderr.write(
      `vaultlier init: missing API key. Pass --api-key or set ${API_KEY_ENV}.\n`,
    );
    return ExitCode.AuthFailed;
  }
  if (!looksLikeApiKey(apiKey)) {
    ctx.stderr.write(
      'vaultlier init: invalid API key format (expected a "vlt_" key)\n',
    );
    return ExitCode.AuthFailed;
  }

  const existingConfigPath = await findConfigPath(ctx.cwd);
  if (flags.force !== true && existingConfigPath) {
    ctx.stderr.write(
      `vaultlier init: ${existingConfigPath.name} already exists\n`,
    );
    ctx.stderr.write("rerun with --force to overwrite generated metadata\n");
    return ExitCode.GenericError;
  }

  const installResult = await ensureVaultlierDependency(flags, ctx);
  if (installResult !== ExitCode.Success) return installResult;

  const configPath = join(ctx.cwd, GENERATED_FILES.config);
  const environments = parseListFlag(flags.environments) ?? [
    "dev",
    "staging",
    "prod",
  ];
  const config: VaultlierConfig = {
    $schema: CONFIG_SCHEMA_URL,
    projectId,
    version: 1,
    environments,
    keys: {},
  };
  const validation = validateConfig(config);
  if (!validation.valid) {
    ctx.stderr.write(`vaultlier init: ${validation.errors.join("; ")}\n`);
    return ExitCode.SchemaInvalid;
  }

  await writeJson(configPath, config);
  await writeGeneratedClient(ctx.cwd, config);
  await writeCredentialCache(ctx.cwd, { projectId, apiKey });

  ctx.stdout.write(`validated - ${environments.length} environments synced\n`);
  ctx.stdout.write(
    `wrote ${GENERATED_FILES.config} - ${GENERATED_FILES.client}\n`,
  );
  return ExitCode.Success;
}

async function pullCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const envResult = validateEnvFlag(flags, config, ctx);
  if (envResult !== ExitCode.Success) return envResult;

  await writeGeneratedClient(ctx.cwd, config);
  ctx.stdout.write(
    `validated - ${config.environments.length} environments synced\n`,
  );
  ctx.stdout.write(`wrote ${GENERATED_FILES.client}\n`);
  return ExitCode.Success;
}

async function whoamiCommand(ctx: CliContext): Promise<ExitCode> {
  const config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const credentials = await readCredentialCache(ctx.cwd);
  ctx.stdout.write(`projectId: ${config.projectId}\n`);
  ctx.stdout.write(`environments: ${config.environments.join(", ")}\n`);
  ctx.stdout.write(
    `apiKey: ${credentials ? maskApiKey(credentials.apiKey) : "(not cached)"}\n`,
  );
  return ExitCode.Success;
}

async function devCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const configPath = await findConfigPath(ctx.cwd);
  const config = await readLocalConfig(ctx);
  if (!config || !configPath) return ExitCode.SchemaInvalid;

  const port = parsePortFlag(flags.port, ctx);
  if (port === undefined) return ExitCode.GenericError;
  const host = typeof flags.host === "string" ? flags.host : DEV_HOST;

  const credentials = await readCredentialCache(ctx.cwd);
  const snapshot = buildSnapshot({
    config,
    configFile: configPath.name,
    maskedApiKey: credentials ? maskApiKey(credentials.apiKey) : null,
  });

  let handle;
  try {
    handle = await startDevServer(snapshot, { port, host });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      ctx.stderr.write(
        `vaultlier dev: port ${port} is already in use. Try --port=<n>.\n`,
      );
    } else {
      ctx.stderr.write(`vaultlier dev: ${(err as Error).message}\n`);
    }
    return ExitCode.GenericError;
  }

  ctx.stdout.write(`vaultlier dev - config UI for ${config.projectId}\n`);
  ctx.stdout.write(`  showing metadata only - secrets stay sealed\n`);
  ctx.stdout.write(`  ${handle.url}\n`);
  ctx.stdout.write(`  press Ctrl+C to stop\n`);

  // Keep the process alive until interrupted. Tests inject their own runner.
  await waitForShutdown(handle.close);
  return ExitCode.Success;
}

/** Resolve when the process receives SIGINT/SIGTERM, then close the server. */
function waitForShutdown(close: () => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    const shutdown = (): void => {
      void close().finally(resolve);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

function parsePortFlag(
  value: string | boolean | undefined,
  ctx: CliContext,
): number | undefined {
  if (typeof value !== "string") return DEV_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    ctx.stderr.write(`vaultlier dev: invalid --port "${value}"\n`);
    return undefined;
  }
  return port;
}

async function portalCommand(
  command: "push" | "diff",
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const envResult = validateEnvFlag(flags, config, ctx);
  if (envResult !== ExitCode.Success) return envResult;

  ctx.stderr.write(
    `vaultlier ${command}: portal API sync is not available in this build yet\n`,
  );
  return ExitCode.GenericError;
}

async function ensureVaultlierDependency(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  if (await hasVaultlierDependency(ctx.cwd)) {
    return ExitCode.Success;
  }

  if (flags["no-install"] === true) {
    ctx.stdout.write(
      "skipped dependency install - run npm install vaultlier\n",
    );
    return ExitCode.Success;
  }

  let shouldInstall = flags.install === true;
  if (!shouldInstall) {
    shouldInstall = await confirm({
      prompt:
        "Install vaultlier in this project before initializing config? [Y/n] ",
      defaultValue: true,
      ctx,
    });
  }

  if (!shouldInstall) {
    ctx.stdout.write(
      "skipped dependency install - run npm install vaultlier\n",
    );
    return ExitCode.Success;
  }

  const { command, args } = await detectInstallCommand(ctx.cwd);
  ctx.stdout.write(`installing dependency - ${command} ${args.join(" ")}\n`);
  let code: number;
  try {
    code = await ctx.installer({ cwd: ctx.cwd, command, args });
  } catch (err) {
    ctx.stderr.write(
      `vaultlier init: dependency install failed: ${(err as Error).message}\n`,
    );
    return ExitCode.GenericError;
  }
  if (code !== 0) {
    ctx.stderr.write(`vaultlier init: dependency install failed (${code})\n`);
    return ExitCode.GenericError;
  }
  return ExitCode.Success;
}

async function hasVaultlierDependency(cwd: string): Promise<boolean> {
  try {
    const pkg = JSON.parse(
      await readFile(join(cwd, "package.json"), "utf8"),
    ) as Partial<{
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
      optionalDependencies: Record<string, string>;
    }>;

    return [
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
      pkg.optionalDependencies,
    ].some((dependencies) => dependencies?.vaultlier !== undefined);
  } catch {
    return false;
  }
}

async function readLocalConfig(
  ctx: CliContext,
): Promise<VaultlierConfig | undefined> {
  try {
    const configPath = await findConfigPath(ctx.cwd);
    if (!configPath) {
      throw new Error(
        `No Vaultlier config found (expected ${CONFIG_FILES.join(" or ")})`,
      );
    }
    const raw = await readFile(configPath.path, "utf8");
    return parseConfig(raw);
  } catch (err) {
    ctx.stderr.write(`vaultlier: ${(err as Error).message}\n`);
    return undefined;
  }
}

function validateEnvFlag(
  flags: Record<string, string | boolean>,
  config: VaultlierConfig,
  ctx: CliContext,
): ExitCode {
  const env = typeof flags.env === "string" ? flags.env : undefined;
  if (!env || env === "all") return ExitCode.Success;
  if (!config.environments.includes(env)) {
    ctx.stderr.write(`vaultlier: unknown environment "${env}"\n`);
    ctx.stderr.write(`known environments: ${config.environments.join(", ")}\n`);
    return ExitCode.SchemaInvalid;
  }
  return ExitCode.Success;
}

async function writeGeneratedClient(
  cwd: string,
  config: VaultlierConfig,
): Promise<void> {
  const clientPath = join(cwd, GENERATED_FILES.client);
  await mkdir(dirname(clientPath), { recursive: true });
  await writeFile(clientPath, generateClient(config), "utf8");
}

async function writeCredentialCache(
  cwd: string,
  credentials: CredentialCache,
): Promise<void> {
  const credentialPath = join(cwd, ".vaultlier", "credentials.json");
  await mkdir(dirname(credentialPath), { recursive: true });
  await writeJson(credentialPath, credentials);
}

async function readCredentialCache(
  cwd: string,
): Promise<CredentialCache | undefined> {
  try {
    const parsed = JSON.parse(
      await readFile(join(cwd, ".vaultlier", "credentials.json"), "utf8"),
    ) as Partial<CredentialCache>;
    if (
      typeof parsed.projectId === "string" &&
      typeof parsed.apiKey === "string"
    ) {
      return { projectId: parsed.projectId, apiKey: parsed.apiKey };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function detectInstallCommand(cwd: string): Promise<InstallCommand> {
  if (await pathExists(join(cwd, "bun.lockb"))) {
    return { command: "bun", args: ["add", "vaultlier"] };
  }
  if (await pathExists(join(cwd, "bun.lock"))) {
    return { command: "bun", args: ["add", "vaultlier"] };
  }
  if (await pathExists(join(cwd, "pnpm-lock.yaml"))) {
    return { command: "pnpm", args: ["add", "vaultlier"] };
  }
  if (await pathExists(join(cwd, "yarn.lock"))) {
    return { command: "yarn", args: ["add", "vaultlier"] };
  }
  return { command: "npm", args: ["install", "vaultlier"] };
}

async function findConfigPath(
  cwd: string,
): Promise<{ name: (typeof CONFIG_FILES)[number]; path: string } | undefined> {
  for (const name of CONFIG_FILES) {
    const path = join(cwd, name);
    if (await pathExists(path)) {
      return { name, path };
    }
  }
  return undefined;
}

function parseListFlag(
  value: string | boolean | undefined,
): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const environments = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return environments.length > 0 ? environments : undefined;
}

async function resolveTextInput(params: {
  flags: Record<string, string | boolean>;
  names: string[];
  prompt: string;
  ctx: CliContext;
  fallback?: string;
}): Promise<string | undefined> {
  for (const name of params.names) {
    const value = params.flags[name];
    if (typeof value === "string" && value.length > 0) return value;
  }
  if (params.fallback) return params.fallback;

  const stdin = params.ctx.stdin as NodeJS.ReadableStream & {
    isTTY?: boolean;
  };
  if (!stdin.isTTY) return undefined;

  const rl = createInterface({
    input: stdin,
    output: processStdout,
  });
  try {
    const answer = await rl.question(params.prompt);
    return answer.trim() || undefined;
  } finally {
    rl.close();
  }
}

async function confirm(params: {
  prompt: string;
  defaultValue: boolean;
  ctx: CliContext;
}): Promise<boolean> {
  const stdin = params.ctx.stdin as NodeJS.ReadableStream & {
    isTTY?: boolean;
  };
  if (!stdin.isTTY) return false;

  const rl = createInterface({
    input: stdin,
    output: processStdout,
  });
  try {
    const answer = (await rl.question(params.prompt)).trim().toLowerCase();
    if (!answer) return params.defaultValue;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function installPackage(params: {
  cwd: string;
  command: string;
  args: string[];
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}
