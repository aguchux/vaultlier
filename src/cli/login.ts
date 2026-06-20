/**
 * `vaultlier login` / `logout` — account authentication for the CLI.
 *
 * Uses the OAuth device-code pattern (see portal.ts for the wire protocol):
 * the CLI prints a verification URL + short code, the user approves in the
 * browser, and the CLI polls until it receives an account token.
 *
 * The token is stored per-user in `~/.vaultlier/auth.json` with owner-only
 * permissions (0600) — never inside the repository, so it cannot be
 * committed. It authorizes account operations (list/create projects), not
 * secret access; project API keys remain separate.
 */

import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { PortalApiError, pollCliLogin, startCliLogin } from "./portal.js";
import type { CliLoginSession, PortalClientOptions } from "./portal.js";

export interface AccountCredentials {
  token: string;
  email?: string;
  /** ISO timestamp of when the login completed; informational only. */
  createdAt?: string;
}

export function authStorePath(home: string = homedir()): string {
  return join(home, ".vaultlier", "auth.json");
}

export async function readAccountCredentials(
  home?: string,
): Promise<AccountCredentials | undefined> {
  try {
    const parsed = JSON.parse(
      await readFile(authStorePath(home), "utf8"),
    ) as Partial<AccountCredentials>;
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      return {
        token: parsed.token,
        email: typeof parsed.email === "string" ? parsed.email : undefined,
        createdAt:
          typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function writeAccountCredentials(
  credentials: AccountCredentials,
  home?: string,
): Promise<void> {
  const path = authStorePath(home);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  // writeFile's mode only applies on creation; enforce on every write.
  // Best-effort on Windows, where POSIX modes do not apply.
  try {
    await chmod(path, 0o600);
  } catch {
    // ignore
  }
}

/** Remove stored account credentials. Resolves whether or not they existed. */
export async function clearAccountCredentials(home?: string): Promise<void> {
  await rm(authStorePath(home), { force: true });
}

export interface DeviceLoginHooks {
  /** Called once the session exists, with the URL + code to show the user. */
  onSession: (session: CliLoginSession) => void;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
}

const MIN_POLL_INTERVAL_MS = 1_000;

/**
 * Run the device-code flow to completion: start a session, hand the
 * URL/code to the caller for display, then poll until approved, denied,
 * or expired. Returns the account credentials on approval.
 */
export async function completeDeviceLogin(
  options: PortalClientOptions,
  hooks: DeviceLoginHooks,
): Promise<AccountCredentials> {
  const session = await startCliLogin(options);
  hooks.onSession(session);

  const sleep =
    hooks.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const intervalMs = Math.max(
    session.pollIntervalSeconds * 1_000,
    MIN_POLL_INTERVAL_MS,
  );
  const deadline = Date.now() + session.expiresInSeconds * 1_000;

  while (Date.now() < deadline) {
    const poll = await pollCliLogin(options, session.sessionId);
    if (poll.status === "approved") {
      return {
        token: poll.token,
        email: poll.email,
        createdAt: new Date().toISOString(),
      };
    }
    if (poll.status === "denied") {
      throw new PortalApiError("login/denied", "login was denied in the browser");
    }
    if (poll.status === "expired") break;
    await sleep(intervalMs);
  }

  throw new PortalApiError(
    "login/expired",
    "login session expired before it was approved - run vaultlier login again",
  );
}
