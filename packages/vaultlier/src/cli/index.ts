/**
 * Vaultlier CLI core. Node-only. Command dispatch lives here; the executable
 * shim is `bin.ts`.
 *
 * Commands: init, pull, push, diff, whoami.
 * All commands return a numeric exit code (see ExitCode).
 */

import { ExitCode } from "../schema/types.js";
import { maskSecret } from "../schema/security.js";

export type CommandName = "init" | "pull" | "push" | "diff" | "whoami";

export interface ParsedArgs {
  command?: string;
  env?: string;
  flags: Record<string, string | boolean>;
}

/** Parse `argv` (without `node` and script path) into a command + flags. */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=", 2);
      if (key) flags[key] = value ?? true;
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

const HELP = `vaultlier — sealed configuration vault CLI

Usage:
  vaultlier <command> [options]

Commands:
  init                 Authenticate and write Vaultlier.json + lib/Vaultlier.ts
  pull --env=<name>    Fetch portal schema and regenerate the typed client
  push --env=<name>    Push local schema additions to the portal
  diff --env=<name>    Show schema differences between local and portal
  whoami               Print the authenticated project/user context

Options:
  --env=<name|all>     Target environment
  --help               Show this help
`;

/**
 * Run the CLI. Returns an exit code. Implementations are stubs that establish
 * the contract (output style, exit codes, no-secret guarantees) and are filled
 * in as the API lands.
 */
export async function run(argv: string[]): Promise<ExitCode> {
  const { command, flags } = parseArgs(argv);

  if (!command || flags.help) {
    process.stdout.write(HELP);
    return ExitCode.Success;
  }

  switch (command as CommandName) {
    case "init":
      return notImplemented("init");
    case "pull":
      return notImplemented("pull");
    case "push":
      return notImplemented("push");
    case "diff":
      return notImplemented("diff");
    case "whoami":
      return notImplemented("whoami");
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return ExitCode.GenericError;
  }
}

function notImplemented(command: string): ExitCode {
  process.stderr.write(`vaultlier ${command}: not yet implemented\n`);
  return ExitCode.GenericError;
}
