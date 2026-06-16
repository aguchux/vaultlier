/**
 * Vaultlier CLI core. Node-only. Command dispatch lives here; the executable
 * shim is `bin.ts`.
 *
 * Commands: init, pull, push, diff, whoami.
 * All commands return a numeric exit code (see ExitCode).
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
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
import type { VaultKeySchema, VaultlierConfig } from "../schema/types.js";
import { looksLikeApiKey, maskSecret } from "../schema/security.js";
import { parseConfig, validateConfig } from "../schema/validate.js";
import { DEV_HOST, DEV_PORT, startDevServer } from "./dev.js";
import type { DevPortal } from "./dev.js";
import {
  API_URL_ENV,
  PortalApiError,
  createEnvironmentRemote,
  createProject,
  deleteEnvironmentRemote,
  diffSchemas,
  fetchEnvironmentConfig,
  fetchPortalSchema,
  fetchStorageConfig,
  isDiffEmpty,
  listProjects,
  pushPortalSchema,
  putEnvironmentSecrets,
  putStorageConfig,
  renameEnvironmentRemote,
  resolveApiUrl,
} from "./portal.js";
import type {
  FetchLike,
  PortalClientOptions,
  PortalSchema,
  ProjectSummary,
  SchemaDiff,
} from "./portal.js";
import {
  clearAccountCredentials,
  completeDeviceLogin,
  readAccountCredentials,
  writeAccountCredentials,
} from "./login.js";
import type { AccountCredentials } from "./login.js";
import { selectFromList } from "./prompt.js";
import {
  discoverEnvMetadata,
  generateEnvFile,
  mergeKeysIntoConfig,
  writeEnvFile,
} from "./env.js";
import { createUi } from "./ui.js";
import type { Ui } from "./ui.js";

export type CommandName =
  | "init"
  | "login"
  | "logout"
  | "config"
  | "pull"
  | "push"
  | "diff"
  | "set"
  | "whoami"
  | "dev"
  | "scan"
  | "generate-key";

export interface ParsedArgs {
  command?: string;
  env?: string;
  flags: Record<string, string | boolean>;
  /** Non-flag arguments after the command, e.g. KEY=VALUE pairs for `set`. */
  positionals: string[];
}

export interface RunOptions {
  cwd?: string;
  /** Home directory for the per-user auth store. Tests inject a temp dir. */
  homedir?: string;
  env?: Record<string, string | undefined>;
  stdin?: NodeJS.ReadableStream;
  stdout?: Pick<NodeJS.WritableStream, "write">;
  stderr?: Pick<NodeJS.WritableStream, "write">;
  installer?: Installer;
  /** Transport for portal sync. Tests inject a fake; defaults to global fetch. */
  fetch?: FetchLike;
  /** Sleep between login polls. Tests inject an immediate resolver. */
  sleep?: (ms: number) => Promise<void>;
}

interface CliContext {
  cwd: string;
  homedir?: string;
  env: Record<string, string | undefined>;
  stdin: NodeJS.ReadableStream;
  stdout: Pick<NodeJS.WritableStream, "write">;
  stderr: Pick<NodeJS.WritableStream, "write">;
  installer: Installer;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  ui: Ui;
}

interface CredentialCache {
  projectId: string;
  apiKey?: string;
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

/** Canonical (kebab-case) flags that take a value. */
const VALUE_FLAGS = new Set([
  "api-key",
  "api-url",
  "env",
  "environments",
  "host",
  "output",
  "port",
  "project-id",
  "project-name",
]);

/** Accepted alternate spellings, normalized to the canonical long name. */
const FLAG_ALIASES: Record<string, string> = {
  apiKey: "api-key",
  apiUrl: "api-url",
  environment: "env",
  projectId: "project-id",
};

/** Single-letter short flags, mapped to their canonical long name. */
const SHORT_FLAGS: Record<string, string> = {
  e: "env",
  f: "force",
  g: "generate",
  h: "help",
  k: "api-key",
  o: "output",
  p: "port",
  v: "version",
  y: "yes",
};

/** Parse `argv` (without `node` and script path) into a command + flags. */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    let name: string | undefined;
    let value: string | undefined;

    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=", 2);
      if (!key) continue;
      name = FLAG_ALIASES[key] ?? key;
      value = inline;
    } else if (arg.startsWith("-") && arg.length > 1) {
      const [key, inline] = arg.slice(1).split("=", 2);
      const long = key ? SHORT_FLAGS[key] : undefined;
      if (!long) continue;
      name = long;
      value = inline;
    } else if (arg.includes("=")) {
      // Bare KEY=VALUE: a positional after a command (`set DB_URL=...`);
      // legacy flag shorthand otherwise (`vaultlier -g env=dev`).
      if (command !== undefined) {
        positionals.push(arg);
      } else {
        const [key, inline] = arg.split("=", 2);
        if (key && inline !== undefined) {
          flags[FLAG_ALIASES[key] ?? key] = inline;
        }
      }
      continue;
    } else if (command === undefined) {
      command = arg;
      continue;
    } else {
      positionals.push(arg);
      continue;
    }

    if (value !== undefined) {
      flags[name] = value;
      continue;
    }
    const next = argv[i + 1];
    if (VALUE_FLAGS.has(name) && next && !next.startsWith("-")) {
      flags[name] = next;
      i += 1;
    } else {
      flags[name] = true;
    }
  }

  const env = typeof flags.env === "string" ? flags.env : undefined;
  return { command, env, flags, positionals };
}

/** Mask an API key for safe display: keep prefix, hide the rest. */
export function maskApiKey(apiKey: string): string {
  return maskSecret(apiKey);
}

const CLI_VERSION = "0.1.14";

const HELP = `vaultlier - sealed configuration vault CLI

Usage:
  vaultlier <command> [options]
  vaultlier set KEY=VALUE [KEY=VALUE ...] --env=<name>
  vaultlier config <set|get|verify> [project=<id>] [apiKey=<key>]
  vaultlier generate-key            (also: vaultlier generate key)

Commands:
  init                   Set up this directory: log in, pick or create a
                         project, and write vaultlier.json + lib/vaultlier.ts
  login                  Authenticate this machine via the browser
  logout                 Remove the locally stored account credentials
  config set k=v ...     Update local settings (project=<prj_id>, apiKey=<vlt_key>)
  config get             Show the current settings (API key masked)
  config verify          Re-validate the project id + API key with the portal
  pull                   Pull portal schema metadata and regenerate the typed client
  push                   Push local schema additions to the portal
  diff                   Show schema differences between local and portal
  set KEY=VALUE ...      Write secret values to one environment (requires --env;
                         creates the environment in the portal when missing)
  whoami                 Print the authenticated project context
  dev                    Start the local config UI on port ${DEV_PORT} (shows
                         remote dev values when an API key is available)
  scan                   Detect env keys and optionally update schema metadata
  generate-key           Print a fresh VAULT_MASTER_KEY (32 random bytes, base64)
                         for the server to seal secrets. Not stored or logged.

Options:
  -e, --env=<name|all>       Target environment (alias: --environment)
      --environments=<a,b>   Initial environment list for init
  -k, --api-key=<key>        API key; cached locally by init, never in generated files
      --api-url=<url>        Portal API base URL (default ${API_URL_ENV} or hosted API)
      --project-id=<id>      Project ID used by init
      --project-name=<name>  Project name when init creates a new project
  -p, --port=<n>             Port for vaultlier dev (default ${DEV_PORT})
      --host=<addr>          Host for vaultlier dev (default ${DEV_HOST}, loopback only)
  -g, --generate             Create a key-only .env file from schema metadata
      --generate-env         Create a key-only .env file after pull
  -o, --output=<path>        Target path for generated key-only .env (default .env)
  -y, --yes                  Accept schema update prompts
      --install              Install vaultlier dependency without prompting
      --no-install           Skip dependency install prompt
  -f, --force                Allow overwriting existing config metadata
  -v, --version              Show the vaultlier CLI version
  -h, --help                 Show this help
`;

/** Run the CLI. Returns an exit code. */
export async function run(
  argv: string[],
  options: RunOptions = {},
): Promise<ExitCode> {
  const { command, flags, positionals } = parseArgs(argv);
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const ctx: CliContext = {
    cwd: options.cwd ?? process.cwd(),
    homedir: options.homedir,
    env,
    stdin: options.stdin ?? processStdin,
    stdout,
    stderr,
    installer: options.installer ?? installPackage,
    fetch: options.fetch,
    sleep: options.sleep,
    ui: createUi({ stdout, stderr, env }),
  };

  // `vaultlier generate key` / `-g key` -> master key generator. Disambiguated
  // from the .env generator (`generate`/`-g` with no `key` positional) by the
  // positional argument.
  if (
    (command === "generate-key") ||
    (command === "generate" && positionals[0] === "key") ||
    (flags.generate === true && positionals[0] === "key")
  ) {
    return generateKeyCommand(ctx);
  }

  if (flags.generate === true && (!command || command === "generate")) {
    return generateCommand(flags, ctx);
  }

  if (flags.version === true) {
    ctx.stdout.write(`${CLI_VERSION}\n`);
    return ExitCode.Success;
  }

  if (!command || flags.help) {
    ctx.stdout.write(HELP);
    return ExitCode.Success;
  }

  switch (command as CommandName) {
    case "init":
      return initCommand(flags, ctx);
    case "login":
      return loginCommand(flags, ctx);
    case "logout":
      return logoutCommand(ctx);
    case "config":
      return configCommand(flags, positionals, ctx);
    case "pull":
      return pullCommand(flags, ctx);
    case "push":
      return portalCommand("push", flags, ctx);
    case "diff":
      return portalCommand("diff", flags, ctx);
    case "set":
      return setCommand(flags, positionals, ctx);
    case "whoami":
      return whoamiCommand(ctx);
    case "dev":
      return devCommand(flags, ctx);
    case "scan":
      return scanCommand(flags, ctx);
    default:
      ctx.ui.error(`Unknown command: ${command}`);
      ctx.stderr.write(`\n${HELP}`);
      return ExitCode.GenericError;
  }
}

async function initCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const existingConfigPath = await findConfigPath(ctx.cwd);
  if (flags.force !== true && existingConfigPath) {
    ctx.ui.error(`vaultlier init: ${existingConfigPath.name} already exists`);
    ctx.stderr.write("rerun with --force to overwrite generated metadata\n");
    return ExitCode.GenericError;
  }

  const installResult = await ensureVaultlierDependency(flags, ctx);
  if (installResult !== ExitCode.Success) return installResult;

  // Project resolution: explicit flag first; otherwise (on a TTY) offer the
  // account flow — log in, pick an existing project, or create one. A plain
  // text prompt remains the last resort so flag-driven and offline workflows
  // keep working.
  let projectId =
    typeof flags["project-id"] === "string" && flags["project-id"].length > 0
      ? flags["project-id"]
      : undefined;
  if (!projectId) {
    projectId = await resolveProjectInteractively(flags, ctx);
  }
  if (!projectId) {
    projectId = await resolveTextInput({
      flags,
      names: ["project-id"],
      prompt: "projectId: ",
      ctx,
    });
  }
  if (!projectId) {
    ctx.ui.error("vaultlier init: missing projectId");
    return ExitCode.SchemaInvalid;
  }

  // The API key is optional at init time: a brand-new account has none yet.
  // Pressing Enter at the prompt skips it; runtime reads then rely on
  // VAULTLIER_API_KEY or a later `vaultlier config set apiKey=...`.
  const apiKey = await resolveTextInput({
    flags,
    names: ["api-key"],
    prompt: "apiKey (press Enter to skip): ",
    ctx,
    fallback: ctx.env[API_KEY_ENV],
  });
  if (apiKey && !looksLikeApiKey(apiKey)) {
    ctx.ui.error(
      'vaultlier init: invalid API key format (expected a "vlt_" key)',
    );
    return ExitCode.AuthFailed;
  }

  const configPath = join(ctx.cwd, GENERATED_FILES.config);
  const environments = parseListFlag(flags.environments) ?? [
    "dev",
    "staging",
    "prod",
  ];
  let config: VaultlierConfig = {
    $schema: CONFIG_SCHEMA_URL,
    projectId,
    version: 1,
    environments,
    keys: {},
  };
  const validation = validateConfig(config);
  if (!validation.valid) {
    ctx.ui.error(`vaultlier init: ${validation.errors.join("; ")}`);
    return ExitCode.SchemaInvalid;
  }

  config = await maybeMergeDetectedKeys(config, flags, ctx, {
    command: "init",
  });

  await writeJson(configPath, config);
  await writeGeneratedClient(ctx.cwd, config);
  await writeCredentialCache(
    ctx.cwd,
    apiKey ? { projectId, apiKey } : { projectId },
  );

  ctx.ui.success(`validated - ${environments.length} environments synced`);
  ctx.ui.success(
    `wrote ${GENERATED_FILES.config} - ${GENERATED_FILES.client}`,
  );
  if (!apiKey) {
    ctx.ui.warn(
      `no API key set - create one in the portal, then run vaultlier config set apiKey=<vlt_...> or set ${API_KEY_ENV}`,
    );
  }
  return ExitCode.Success;
}

/**
 * Interactive project resolution for `init`: ensure the user is logged in
 * (offering the browser login), then let them pick an existing project or
 * create a new one. Returns undefined when not interactive, declined, or on
 * error — callers fall back to a plain prompt.
 */
async function resolveProjectInteractively(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<string | undefined> {
  const stdin = ctx.stdin as NodeJS.ReadableStream & { isTTY?: boolean };
  if (stdin.isTTY !== true) return undefined;

  let account = await readAccountCredentials(ctx.homedir);
  if (!account) {
    const shouldLogin = await confirm({
      prompt: "Log in to Vaultlier to choose or create a project? [Y/n] ",
      defaultValue: true,
      ctx,
    });
    if (!shouldLogin) return undefined;
    account = await runDeviceLogin(flags, ctx);
    if (!account) return undefined;
  }

  const options = accountPortalOptions(flags, ctx, account.token);
  let projects: ProjectSummary[];
  try {
    projects = await ctx.ui.spin("loading your projects", () =>
      listProjects(options),
    );
  } catch (err) {
    reportPortalError("init", err, ctx);
    return undefined;
  }

  const choices = [
    { label: "Create a new project" },
    ...projects.map((project) => ({
      label: project.name,
      hint: project.organization
        ? `${project.publicId} - ${project.organization}`
        : project.publicId,
    })),
  ];
  const picked = await selectFromList({
    title:
      projects.length > 0
        ? "Select a project for this directory"
        : "No projects yet",
    options: choices,
    stdin,
    stdout: ctx.stdout,
    style: ctx.ui.style,
    initialIndex: projects.length > 0 ? 1 : 0,
  });
  if (picked === undefined) return undefined;
  if (picked > 0) {
    const project = projects[picked - 1]!;
    ctx.ui.success(`using project "${project.name}" (${project.publicId})`);
    return project.publicId;
  }

  const name = await resolveTextInput({
    flags,
    names: ["project-name"],
    prompt: "new project name: ",
    ctx,
  });
  if (!name) {
    ctx.ui.error("vaultlier init: missing project name");
    return undefined;
  }
  try {
    const created = await ctx.ui.spin(`creating project "${name}"`, () =>
      createProject(options, name),
    );
    ctx.ui.success(`created project "${created.name}" (${created.publicId})`);
    return created.publicId;
  } catch (err) {
    reportPortalError("init", err, ctx);
    return undefined;
  }
}

/**
 * `vaultlier login` — device-code authentication. Prints a browser URL and a
 * short code, then waits for approval. The resulting account token is stored
 * per-user (never in the repo) and authorizes project list/create only.
 */
async function loginCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const existing = await readAccountCredentials(ctx.homedir);
  if (existing && flags.force !== true) {
    ctx.ui.success(
      `already logged in${existing.email ? ` as ${existing.email}` : ""} - run vaultlier logout first to switch accounts`,
    );
    return ExitCode.Success;
  }
  const credentials = await runDeviceLogin(flags, ctx);
  return credentials ? ExitCode.Success : ExitCode.AuthFailed;
}

/** `vaultlier logout` — remove the locally stored account token. */
async function logoutCommand(ctx: CliContext): Promise<ExitCode> {
  const existing = await readAccountCredentials(ctx.homedir);
  await clearAccountCredentials(ctx.homedir);
  if (existing) {
    ctx.ui.success("logged out - local account credentials removed");
  } else {
    ctx.ui.info("not logged in - nothing to remove");
  }
  return ExitCode.Success;
}

/** Run the device flow, persist credentials, and report the outcome. */
async function runDeviceLogin(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<AccountCredentials | undefined> {
  const options: PortalClientOptions = {
    apiUrl: resolveApiUrl(flags["api-url"], ctx.env),
    fetchImpl: ctx.fetch,
  };
  const { style } = ctx.ui;
  try {
    const credentials = await completeDeviceLogin(options, {
      onSession: (session) => {
        ctx.stdout.write(`\nTo authenticate, open this link in a browser:\n`);
        ctx.stdout.write(`  ${style.cyan(session.verificationUrl)}\n`);
        ctx.stdout.write(
          `and confirm the code ${style.bold(session.userCode)}\n\n`,
        );
        ctx.ui.info("waiting for approval in the browser...");
      },
      sleep: ctx.sleep,
    });
    await writeAccountCredentials(credentials, ctx.homedir);
    ctx.ui.success(
      `logged in${credentials.email ? ` as ${credentials.email}` : ""}`,
    );
    return credentials;
  } catch (err) {
    reportPortalError("login", err, ctx);
    return undefined;
  }
}

function accountPortalOptions(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
  token: string,
): PortalClientOptions {
  return {
    apiUrl: resolveApiUrl(flags["api-url"], ctx.env),
    apiKey: token,
    fetchImpl: ctx.fetch,
  };
}

const CONFIG_SET_USAGE =
  "usage: vaultlier config set project=<prj_id> apiKey=<vlt_key>";

/**
 * `vaultlier config <set|get|verify>` — manage the local project binding.
 *
 *   set project=<id>   update vaultlier.json + credential cache (+ client)
 *   set apiKey=<key>   update the local credential cache (never printed)
 *   get                show the current configuration (masked)
 *   verify             re-validate the project id + API key with the portal
 */
async function configCommand(
  flags: Record<string, string | boolean>,
  positionals: string[],
  ctx: CliContext,
): Promise<ExitCode> {
  const action = positionals[0];
  switch (action) {
    case "set":
      return configSetCommand(positionals.slice(1), ctx);
    case "get":
      return configGetCommand(ctx);
    case "verify":
      return configVerifyCommand(flags, ctx);
    default:
      ctx.ui.error(
        `vaultlier config: unknown action "${action ?? ""}" - use set, get, or verify`,
      );
      return ExitCode.GenericError;
  }
}

async function configSetCommand(
  pairs: string[],
  ctx: CliContext,
): Promise<ExitCode> {
  if (pairs.length === 0) {
    ctx.ui.error(`vaultlier config set: nothing to set. ${CONFIG_SET_USAGE}`);
    return ExitCode.SchemaInvalid;
  }

  const updates: { projectId?: string; apiKey?: string } = {};
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    const key = separator === -1 ? pair : pair.slice(0, separator);
    const value = separator === -1 ? "" : pair.slice(separator + 1);
    if (key === "project" || key === "projectId" || key === "project-id") {
      if (!value) {
        ctx.ui.error("vaultlier config set: project requires a value");
        return ExitCode.SchemaInvalid;
      }
      updates.projectId = value;
    } else if (key === "apiKey" || key === "api-key") {
      if (!looksLikeApiKey(value)) {
        ctx.ui.error(
          'vaultlier config set: invalid API key format (expected a "vlt_" key)',
        );
        return ExitCode.AuthFailed;
      }
      updates.apiKey = value;
    } else {
      ctx.ui.error(
        `vaultlier config set: unknown setting "${key}". ${CONFIG_SET_USAGE}`,
      );
      return ExitCode.SchemaInvalid;
    }
  }

  const cache = await readCredentialCache(ctx.cwd);
  const configPath = await findConfigPath(ctx.cwd);

  if (updates.projectId && configPath) {
    const config = await readLocalConfig(ctx);
    if (!config) return ExitCode.SchemaInvalid;
    const updated = { ...config, projectId: updates.projectId };
    await writeJson(configPath.path, updated);
    await writeGeneratedClient(ctx.cwd, updated);
  }

  const projectId = updates.projectId ?? cache?.projectId;
  if (!projectId) {
    ctx.ui.error(
      "vaultlier config set: no project configured - pass project=<id> or run vaultlier init",
    );
    return ExitCode.SchemaInvalid;
  }
  await writeCredentialCache(ctx.cwd, {
    projectId,
    apiKey: updates.apiKey ?? cache?.apiKey,
  });

  if (updates.projectId) {
    ctx.ui.success(`project set to ${updates.projectId}`);
  }
  if (updates.apiKey) {
    ctx.ui.success(`apiKey updated (${maskApiKey(updates.apiKey)})`);
  }
  return ExitCode.Success;
}

async function configGetCommand(ctx: CliContext): Promise<ExitCode> {
  const configPath = await findConfigPath(ctx.cwd);
  const config = configPath ? await readLocalConfig(ctx) : undefined;
  const cache = await readCredentialCache(ctx.cwd);
  const account = await readAccountCredentials(ctx.homedir);
  const { style } = ctx.ui;

  const projectId = config?.projectId ?? cache?.projectId;
  ctx.stdout.write(
    `project: ${projectId ? style.cyan(projectId) : style.dim("(not set)")}\n`,
  );
  ctx.stdout.write(
    `apiKey: ${cache?.apiKey ? style.dim(maskApiKey(cache.apiKey)) : style.dim("(not set)")}\n`,
  );
  ctx.stdout.write(
    `account: ${account ? style.cyan(account.email ?? "logged in") : style.dim("(not logged in)")}\n`,
  );
  return ExitCode.Success;
}

async function configVerifyCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const apiKey = await resolveCliApiKey(flags, ctx);
  if (!apiKey) {
    ctx.ui.error(
      `vaultlier config verify: no API key found. Run vaultlier config set apiKey=<vlt_...> or set ${API_KEY_ENV}.`,
    );
    return ExitCode.AuthFailed;
  }
  if (!looksLikeApiKey(apiKey)) {
    ctx.ui.error(
      'vaultlier config verify: invalid API key format (expected a "vlt_" key)',
    );
    return ExitCode.AuthFailed;
  }

  let portal: PortalSchema;
  try {
    portal = await ctx.ui.spin("verifying credentials with the portal", () =>
      fetchPortalSchema(portalOptions(flags, ctx, apiKey), config.projectId),
    );
  } catch (err) {
    return reportPortalError("config verify", err, ctx);
  }
  ctx.ui.success(
    `apiKey is valid for project ${config.projectId} (portal schema v${portal.version})`,
  );
  return ExitCode.Success;
}

async function pullCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  let config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const envResult = validateEnvFlag(flags, config, ctx);
  if (envResult !== ExitCode.Success) return envResult;

  // Sync from the portal when credentials are available; otherwise fall back
  // to regenerating from local metadata so offline workflows keep working.
  const apiKey = await resolveCliApiKey(flags, ctx);
  if (apiKey) {
    const projectId = config.projectId;
    let portal: PortalSchema;
    try {
      portal = await ctx.ui.spin("pulling schema metadata from the portal", () =>
        fetchPortalSchema(portalOptions(flags, ctx, apiKey), projectId),
      );
    } catch (err) {
      return reportPortalError("pull", err, ctx);
    }
    config = applyPortalSchema(config, portal);
    const configPath = await findConfigPath(ctx.cwd);
    if (!configPath) return ExitCode.SchemaInvalid;
    await writeJson(configPath.path, config);
    ctx.ui.success(`pulled portal schema v${portal.version}`);
  } else {
    ctx.ui.warn("no API key found - using local schema metadata");
  }

  await writeGeneratedClient(ctx.cwd, config);
  if (flags["generate-env"] === true) {
    const envCode = await writeKeyOnlyEnvFile(config, flags, ctx);
    if (envCode !== ExitCode.Success) return envCode;
  }
  ctx.ui.success(
    `validated - ${config.environments.length} environments synced`,
  );
  ctx.ui.success(`wrote ${GENERATED_FILES.client}`);
  return ExitCode.Success;
}

async function whoamiCommand(ctx: CliContext): Promise<ExitCode> {
  const config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const credentials = await readCredentialCache(ctx.cwd);
  const { style } = ctx.ui;
  ctx.stdout.write(`projectId: ${style.cyan(config.projectId)}\n`);
  ctx.stdout.write(`environments: ${config.environments.join(", ")}\n`);
  ctx.stdout.write(
    `apiKey: ${style.dim(credentials?.apiKey ? maskApiKey(credentials.apiKey) : "(not cached)")}\n`,
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
  const apiKey = await resolveCliApiKey(flags, ctx);

  // With an API key the UI manages the project live against the remote; without
  // one it is read-only and shows local metadata. The key stays in this
  // process — the loopback server proxies to the portal and never sends it to
  // the browser.
  let portal: DevPortal | null = null;
  let readOnlyReason: string | null = null;
  if (apiKey) {
    const options = portalOptions(flags, ctx, apiKey);
    const projectId = config.projectId;
    portal = {
      getValues: async (environment) => {
        const values = await fetchEnvironmentConfig(options, projectId, environment);
        return Object.fromEntries(
          Object.entries(values).map(([name, value]) => [
            name,
            typeof value === "string" ? value : JSON.stringify(value),
          ]),
        );
      },
      setValues: (environment, secrets) =>
        putEnvironmentSecrets(options, projectId, environment, secrets).then(
          () => undefined,
        ),
      createEnvironment: (name) =>
        createEnvironmentRemote(options, projectId, name),
      renameEnvironment: (name, to) =>
        renameEnvironmentRemote(options, projectId, name, to),
      deleteEnvironment: (name) =>
        deleteEnvironmentRemote(options, projectId, name),
      getStorage: async () => {
        const view = await fetchStorageConfig(options, projectId);
        return {
          adapterType: view.adapterType,
          metadata: view.metadata,
          lastTestStatus: view.lastTestStatus,
        };
      },
      setStorage: (adapterType, cfg) =>
        putStorageConfig(options, projectId, adapterType, cfg),
    };
  } else {
    readOnlyReason = `${API_KEY_ENV} is not set — connect an API key to manage this project. Set ${API_KEY_ENV} or run \`vaultlier config set apiKey=…\`.`;
  }

  let handle;
  try {
    handle = await startDevServer({
      config,
      configFile: configPath.name,
      maskedApiKey: credentials?.apiKey ? maskApiKey(credentials.apiKey) : null,
      portal,
      readOnlyReason,
      port,
      host,
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      ctx.ui.error(
        `vaultlier dev: port ${port} is already in use. Try --port=<n>.`,
      );
    } else {
      ctx.ui.error(`vaultlier dev: ${(err as Error).message}`);
    }
    return ExitCode.GenericError;
  }

  const { style } = ctx.ui;
  ctx.stdout.write(
    `${style.bold("vaultlier dev")} - manage ${style.cyan(config.projectId)}\n`,
  );
  if (portal) {
    ctx.stdout.write(
      `  edit values, environments, and storage - changes sync to the remote\n`,
    );
  } else {
    ctx.ui.warn(readOnlyReason ?? "read-only");
  }
  ctx.stdout.write(`  ${style.cyan(handle.url)}\n`);
  ctx.stdout.write(`  ${style.dim("press Ctrl+C to stop")}\n`);

  // Keep the process alive until interrupted. Tests inject their own runner.
  await waitForShutdown(handle.close);
  return ExitCode.Success;
}

async function scanCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const discovery = await ctx.ui.spin("scanning for env keys", () =>
    discoverEnvMetadata(ctx.cwd),
  );
  if (discovery.keys.length === 0) {
    ctx.ui.info("no env keys detected");
    return ExitCode.Success;
  }

  ctx.ui.success(`detected ${discovery.keys.length} env keys`);
  for (const key of discovery.keys) {
    ctx.stdout.write(`  ${ctx.ui.style.cyan(key)}\n`);
  }

  const configPath = await findConfigPath(ctx.cwd);
  if (!configPath) {
    ctx.ui.warn("no Vaultlier config found - run vaultlier init");
    return ExitCode.Success;
  }

  const config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const updatedConfig = await maybeMergeDetectedKeys(config, flags, ctx, {
    command: "scan",
    discovery,
  });
  if (updatedConfig === config) return ExitCode.Success;

  await writeJson(configPath.path, updatedConfig);
  await writeGeneratedClient(ctx.cwd, updatedConfig);
  ctx.ui.success(`wrote ${configPath.name} - ${GENERATED_FILES.client}`);
  return ExitCode.Success;
}

async function generateCommand(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const envResult = validateEnvFlag(flags, config, ctx);
  if (envResult !== ExitCode.Success) return envResult;

  return writeKeyOnlyEnvFile(config, flags, ctx);
}

/**
 * `vaultlier generate-key` — print a fresh VAULT_MASTER_KEY.
 *
 * Generates 32 cryptographically-random bytes, base64-encoded — the exact shape
 * the server's vault layer expects. The key is written ONCE to stdout and
 * NOTHING else: it is never stored, cached, logged, or sent anywhere. Guidance
 * goes to stderr so `vaultlier generate-key` can be piped to capture only the
 * key (e.g. `vaultlier generate-key > /dev/null` won't leak it to logs).
 */
function generateKeyCommand(ctx: CliContext): ExitCode {
  const key = randomBytes(32).toString("base64");
  // The key itself: stdout only, nothing else on that stream.
  ctx.stdout.write(`${key}\n`);

  const { style } = ctx.ui;
  ctx.stderr.write(
    `\n${style.bold("VAULT_MASTER_KEY")} - set this on the server (e.g. your host's env vars):\n` +
      `  ${style.dim("VAULT_MASTER_KEY=<the value above>")}\n\n` +
      `${style.dim("• 32 random bytes, base64 — sealed/unsealed with AES-256-GCM per project.")}\n` +
      `${style.dim("• Treat it like a root credential. It is NOT stored, logged, or tracked by this command.")}\n` +
      `${style.dim("• Set it once and keep it: changing or losing it makes existing secrets unrecoverable.")}\n`,
  );
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
  let config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const envResult = validateEnvFlag(flags, config, ctx);
  if (envResult !== ExitCode.Success) return envResult;

  if (command === "push") {
    const updatedConfig = await maybeMergeDetectedKeys(config, flags, ctx, {
      command,
    });
    if (updatedConfig !== config) {
      const configPath = await findConfigPath(ctx.cwd);
      if (!configPath) return ExitCode.SchemaInvalid;
      config = updatedConfig;
      await writeJson(configPath.path, config);
      await writeGeneratedClient(ctx.cwd, config);
    }
  }

  const apiKey = await resolveCliApiKey(flags, ctx);
  if (!apiKey) {
    ctx.ui.error(
      `vaultlier ${command}: missing API key. Pass --api-key, set ${API_KEY_ENV}, or run vaultlier init.`,
    );
    return ExitCode.AuthFailed;
  }
  if (!looksLikeApiKey(apiKey)) {
    ctx.ui.error(
      `vaultlier ${command}: invalid API key format (expected a "vlt_" key)`,
    );
    return ExitCode.AuthFailed;
  }
  const options = portalOptions(flags, ctx, apiKey);
  const localConfig = config;

  if (command === "diff") {
    let portal: PortalSchema;
    try {
      portal = await ctx.ui.spin("fetching portal schema", () =>
        fetchPortalSchema(options, localConfig.projectId),
      );
    } catch (err) {
      return reportPortalError("diff", err, ctx);
    }
    printSchemaDiff(diffSchemas(config, portal), config, portal, ctx);
    return ExitCode.Success;
  }

  let portal: PortalSchema;
  try {
    portal = await ctx.ui.spin("pushing schema metadata to the portal", () =>
      pushPortalSchema(options, localConfig),
    );
  } catch (err) {
    return reportPortalError("push", err, ctx);
  }

  const syncedConfig = applyPortalSchema(config, portal);
  const configPath = await findConfigPath(ctx.cwd);
  if (!configPath) return ExitCode.SchemaInvalid;
  await writeJson(configPath.path, syncedConfig);
  await writeGeneratedClient(ctx.cwd, syncedConfig);
  ctx.ui.success(`pushed schema metadata - portal now at v${portal.version}`);
  return ExitCode.Success;
}

const KEY_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Mirrors the portal's environment-name rule so we can fail fast locally. */
const ENV_NAME_PATTERN = /^[a-z0-9][a-z0-9-_]*$/i;

/**
 * `vaultlier set KEY=VALUE [...] --env=<name>` — write secret values to one
 * environment via the portal. Values are sent over HTTPS, sealed server-side,
 * and never written to disk or echoed back here. An environment that does not
 * exist yet is created via an additive schema push (after confirmation, or
 * `--yes`).
 */
async function setCommand(
  flags: Record<string, string | boolean>,
  positionals: string[],
  ctx: CliContext,
): Promise<ExitCode> {
  let config = await readLocalConfig(ctx);
  if (!config) return ExitCode.SchemaInvalid;

  const environment = getEnvFlag(flags);
  if (!environment || environment === "all") {
    ctx.ui.error(
      "vaultlier set: a single target environment is required, e.g. --env=prod",
    );
    return ExitCode.SchemaInvalid;
  }

  let createEnvironment = false;
  if (!config.environments.includes(environment)) {
    if (!ENV_NAME_PATTERN.test(environment)) {
      ctx.ui.error(`vaultlier set: invalid environment name "${environment}"`);
      return ExitCode.SchemaInvalid;
    }
    let shouldCreate = flags.yes === true;
    if (!shouldCreate) {
      shouldCreate = await confirm({
        prompt: `Environment "${environment}" does not exist. Create it in the portal? [y/N] `,
        defaultValue: false,
        ctx,
      });
    }
    if (!shouldCreate) {
      ctx.ui.error(
        `vaultlier set: unknown environment "${environment}" - rerun with --yes to create it`,
      );
      ctx.stderr.write(
        `known environments: ${config.environments.join(", ")}\n`,
      );
      return ExitCode.SchemaInvalid;
    }
    createEnvironment = true;
  }

  if (positionals.length === 0) {
    ctx.ui.error(
      "vaultlier set: provide at least one KEY=VALUE pair, e.g. vaultlier set DATABASE_URL=postgres://... --env=prod",
    );
    return ExitCode.SchemaInvalid;
  }

  const secrets: Record<string, string> = {};
  for (const pair of positionals) {
    const separator = pair.indexOf("=");
    if (separator === -1) {
      ctx.ui.error(
        `vaultlier set: "${pair}" is missing a value - use KEY=VALUE`,
      );
      return ExitCode.SchemaInvalid;
    }
    const name = pair.slice(0, separator);
    if (!KEY_NAME_PATTERN.test(name)) {
      ctx.ui.error(`vaultlier set: invalid key name "${name}"`);
      return ExitCode.SchemaInvalid;
    }
    secrets[name] = pair.slice(separator + 1);
  }

  // Fail fast on schema problems locally so values of misnamed keys never
  // leave the machine; the server enforces the same rules authoritatively.
  for (const name of Object.keys(secrets)) {
    const schema = config.keys[name];
    if (!schema) {
      ctx.ui.error(
        `vaultlier set: key "${name}" is not in the project schema - run vaultlier push first`,
      );
      return ExitCode.SchemaInvalid;
    }
    const scopes = schema.scopes ?? ["all"];
    if (!scopes.includes("all") && !scopes.includes(environment)) {
      ctx.ui.error(
        `vaultlier set: key "${name}" is not scoped to environment "${environment}" (scopes: ${scopes.join(", ")})`,
      );
      return ExitCode.SchemaInvalid;
    }
  }

  const apiKey = await resolveCliApiKey(flags, ctx);
  if (!apiKey) {
    ctx.ui.error(
      `vaultlier set: missing API key. Pass --api-key, set ${API_KEY_ENV}, or run vaultlier init.`,
    );
    return ExitCode.AuthFailed;
  }
  if (!looksLikeApiKey(apiKey)) {
    ctx.ui.error(
      'vaultlier set: invalid API key format (expected a "vlt_" key)',
    );
    return ExitCode.AuthFailed;
  }

  const options = portalOptions(flags, ctx, apiKey);

  // Create the environment remotely first via additive schema push; the
  // portal never deletes anything on this path.
  if (createEnvironment) {
    const synced = await syncEnvironmentToPortal(
      { ...config, environments: [...config.environments, environment] },
      options,
      ctx,
    );
    if (!synced.ok) return synced.code;
    config = synced.config;
    ctx.ui.success(
      `created environment "${environment}" (portal v${config.version})`,
    );
  }

  const writeLabel = `writing ${Object.keys(secrets).length} value${
    Object.keys(secrets).length === 1 ? "" : "s"
  } to "${environment}"`;
  let projectId = config.projectId;
  let result;
  try {
    result = await ctx.ui.spin(writeLabel, () =>
      putEnvironmentSecrets(options, projectId, environment, secrets),
    );
  } catch (err) {
    // The environment exists locally but not in the portal yet (e.g. added
    // by hand to vaultlier.json): sync the declared schema and retry once.
    const missingRemotely =
      !createEnvironment &&
      err instanceof PortalApiError &&
      err.code === "environment/unknown";
    if (!missingRemotely) return reportPortalError("set", err, ctx);

    const synced = await syncEnvironmentToPortal(config, options, ctx);
    if (!synced.ok) return synced.code;
    config = synced.config;
    ctx.ui.success(
      `created environment "${environment}" (portal v${config.version})`,
    );
    projectId = config.projectId;
    try {
      result = await ctx.ui.spin(writeLabel, () =>
        putEnvironmentSecrets(options, projectId, environment, secrets),
      );
    } catch (retryErr) {
      return reportPortalError("set", retryErr, ctx);
    }
  }

  const { style } = ctx.ui;
  for (const [name, version] of Object.entries(result.versions)) {
    ctx.stdout.write(`  ${style.cyan(name)} -> ${style.green(`v${version}`)}\n`);
  }
  const count = Object.keys(result.versions).length;
  ctx.ui.success(
    `set ${count} value${count === 1 ? "" : "s"} in "${result.environment}"`,
  );
  return ExitCode.Success;
}

/**
 * Push `config` (schema metadata only) to the portal and adopt the returned
 * schema locally — used by `set` to create a missing environment.
 */
async function syncEnvironmentToPortal(
  config: VaultlierConfig,
  options: PortalClientOptions,
  ctx: CliContext,
): Promise<
  { ok: true; config: VaultlierConfig } | { ok: false; code: ExitCode }
> {
  let portal: PortalSchema;
  try {
    portal = await ctx.ui.spin("syncing schema to the portal", () =>
      pushPortalSchema(options, config),
    );
  } catch (err) {
    return { ok: false, code: reportPortalError("set", err, ctx) };
  }
  const synced = applyPortalSchema(config, portal);
  const configPath = await findConfigPath(ctx.cwd);
  if (!configPath) return { ok: false, code: ExitCode.SchemaInvalid };
  await writeJson(configPath.path, synced);
  await writeGeneratedClient(ctx.cwd, synced);
  return { ok: true, config: synced };
}

function portalOptions(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
  apiKey: string,
): PortalClientOptions {
  return {
    apiUrl: resolveApiUrl(flags["api-url"], ctx.env),
    apiKey,
    fetchImpl: ctx.fetch,
  };
}

/**
 * API key resolution for portal commands: explicit flag, then the runtime
 * env var, then the local credential cache written by `vaultlier init`.
 */
async function resolveCliApiKey(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<string | undefined> {
  const value = flags["api-key"];
  if (typeof value === "string" && value.length > 0) return value;
  if (ctx.env[API_KEY_ENV]) return ctx.env[API_KEY_ENV];
  return (await readCredentialCache(ctx.cwd))?.apiKey;
}

/** Adopt the portal's schema locally, preserving local key descriptions. */
function applyPortalSchema(
  config: VaultlierConfig,
  portal: PortalSchema,
): VaultlierConfig {
  const keys: Record<string, VaultKeySchema> = {};
  for (const [name, schema] of Object.entries(portal.keys)) {
    const description = config.keys[name]?.description;
    keys[name] = {
      type: schema.type,
      ...(schema.scopes ? { scopes: schema.scopes } : {}),
      ...(description ? { description } : {}),
    };
  }
  return {
    ...config,
    version: portal.version,
    environments: portal.environments,
    keys,
  };
}

function printSchemaDiff(
  diff: SchemaDiff,
  config: VaultlierConfig,
  portal: PortalSchema,
  ctx: CliContext,
): void {
  if (isDiffEmpty(diff)) {
    ctx.ui.success(`schema in sync with portal (v${portal.version})`);
    return;
  }
  const { style } = ctx.ui;
  ctx.stdout.write(`local v${config.version} vs portal v${portal.version}\n`);
  for (const name of diff.environmentsOnlyLocal) {
    ctx.stdout.write(
      style.green(`  + env ${name} (local only - push to create)`) + "\n",
    );
  }
  for (const name of diff.environmentsOnlyPortal) {
    ctx.stdout.write(
      style.red(`  - env ${name} (portal only - pull to fetch)`) + "\n",
    );
  }
  for (const name of diff.onlyLocal) {
    ctx.stdout.write(
      style.green(`  + ${name} (local only - push to create)`) + "\n",
    );
  }
  for (const name of diff.onlyPortal) {
    ctx.stdout.write(
      style.red(`  - ${name} (portal only - pull to fetch)`) + "\n",
    );
  }
  for (const name of diff.changed) {
    ctx.stdout.write(
      style.yellow(`  ~ ${name} (type or scopes differ)`) + "\n",
    );
  }
}

function reportPortalError(
  command: string,
  err: unknown,
  ctx: CliContext,
): ExitCode {
  if (err instanceof PortalApiError) {
    const suffix = err.requestId ? ` (request ${err.requestId})` : "";
    ctx.ui.error(`vaultlier ${command}: ${err.message}${suffix}`);
    if (err.status === 401 || err.status === 403) return ExitCode.AuthFailed;
    if (err.status === 409) return ExitCode.Conflict;
    return ExitCode.GenericError;
  }
  ctx.ui.error(`vaultlier ${command}: ${(err as Error).message}`);
  return ExitCode.GenericError;
}

async function maybeMergeDetectedKeys(
  config: VaultlierConfig,
  flags: Record<string, string | boolean>,
  ctx: CliContext,
  params: {
    command: "init" | "push" | "scan";
    discovery?: Awaited<ReturnType<typeof discoverEnvMetadata>>;
  },
): Promise<VaultlierConfig> {
  const discovery = params.discovery ?? (await discoverEnvMetadata(ctx.cwd));
  const { config: updatedConfig, added } = mergeKeysIntoConfig(
    config,
    discovery.keys,
  );

  if (discovery.keys.length === 0 || added.length === 0) {
    if (params.command === "scan" && discovery.keys.length > 0) {
      ctx.stdout.write("schema already includes detected keys\n");
    }
    return config;
  }

  ctx.stdout.write(
    `detected ${added.length} new env keys for schema metadata\n`,
  );
  for (const key of added) {
    ctx.stdout.write(`  ${ctx.ui.style.cyan(key)}\n`);
  }

  let shouldUpdate = flags.yes === true;
  if (!shouldUpdate) {
    shouldUpdate = await confirm({
      prompt:
        "Add detected keys to Vaultlier schema metadata? Values are ignored. [y/N] ",
      defaultValue: false,
      ctx,
    });
  }

  if (!shouldUpdate) {
    ctx.ui.warn("skipped schema metadata update");
    return config;
  }

  return updatedConfig;
}

async function writeKeyOnlyEnvFile(
  config: VaultlierConfig,
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  const output = typeof flags.output === "string" ? flags.output : ".env";
  const path = join(ctx.cwd, output);

  if (flags.force !== true && (await pathExists(path))) {
    const shouldOverwrite = await confirm({
      prompt: `${output} already exists. Overwrite with key-only schema file? [y/N] `,
      defaultValue: false,
      ctx,
    });
    if (!shouldOverwrite) {
      ctx.ui.warn(`skipped ${output}`);
      return ExitCode.Success;
    }
  }

  await mkdir(dirname(path), { recursive: true });
  await writeEnvFile(path, generateEnvFile(config, getEnvFlag(flags)));
  ctx.ui.success(`wrote ${output} - keys only, no values`);
  return ExitCode.Success;
}

async function ensureVaultlierDependency(
  flags: Record<string, string | boolean>,
  ctx: CliContext,
): Promise<ExitCode> {
  if (await hasVaultlierDependency(ctx.cwd)) {
    return ExitCode.Success;
  }

  if (flags["no-install"] === true) {
    ctx.ui.warn("skipped dependency install - run npm install vaultlier");
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
    ctx.ui.warn("skipped dependency install - run npm install vaultlier");
    return ExitCode.Success;
  }

  const { command, args } = await detectInstallCommand(ctx.cwd);
  // No spinner here: the installer inherits stdio and animates on its own.
  ctx.stdout.write(`installing dependency - ${command} ${args.join(" ")}\n`);
  let code: number;
  try {
    code = await ctx.installer({ cwd: ctx.cwd, command, args });
  } catch (err) {
    ctx.ui.error(
      `vaultlier init: dependency install failed: ${(err as Error).message}`,
    );
    return ExitCode.GenericError;
  }
  if (code !== 0) {
    ctx.ui.error(`vaultlier init: dependency install failed (${code})`);
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
    ctx.ui.error(`vaultlier: ${(err as Error).message}`);
    return undefined;
  }
}

function validateEnvFlag(
  flags: Record<string, string | boolean>,
  config: VaultlierConfig,
  ctx: CliContext,
): ExitCode {
  const env = getEnvFlag(flags);
  if (!env || env === "all") return ExitCode.Success;
  if (!config.environments.includes(env)) {
    ctx.ui.error(`vaultlier: unknown environment "${env}"`);
    ctx.stderr.write(`known environments: ${config.environments.join(", ")}\n`);
    return ExitCode.SchemaInvalid;
  }
  return ExitCode.Success;
}

function getEnvFlag(
  flags: Record<string, string | boolean>,
): string | undefined {
  return typeof flags.env === "string" ? flags.env : undefined;
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
    if (typeof parsed.projectId === "string") {
      return {
        projectId: parsed.projectId,
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined,
      };
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
