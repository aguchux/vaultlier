/**
 * Server-side helpers for the CLI device-code login flow.
 *
 * Mirrors the wire protocol the `vaultlier` CLI implements (see the package's
 * cli/portal.ts):
 *   POST /v1/cli/sessions            -> start a session (publicId + userCode)
 *   GET  /v1/cli/sessions/:publicId  -> poll until approved/denied/expired
 *   GET  /v1/projects (account tok)  -> list projects
 *   POST /v1/projects (account tok)  -> create a project
 *
 * Account tokens authorize account-scoped operations (list/create projects)
 * for their owner. They never grant secret access — that always requires a
 * project ApiKey. Like ApiKeys, only a SHA-256 hash + a display prefix are
 * stored; the raw token is returned exactly once.
 */

import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@vaultlier/db";
import type { CliToken, User } from "@vaultlier/db";

/** Device-login session lifetime and how often the CLI should poll. */
export const CLI_SESSION_TTL_SECONDS = 15 * 60;
export const CLI_POLL_INTERVAL_SECONDS = 5;

/** Account tokens are long-lived but not eternal. */
const CLI_TOKEN_TTL_DAYS = 90;

// Crockford-style alphabet: no 0/O/1/I to keep the spoken/typed code clear.
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CLI_TOKEN_PREFIXES = ["vlt_login_", "vlt_acct_"];

export function hashCliToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Generate a raw account token. Returned once; only the hash is stored. */
export function generateCliToken(): { rawToken: string; prefix: string } {
  const rawToken = `vlt_login_${randomBytes(24).toString("hex")}`;
  return { rawToken, prefix: rawToken.slice(0, 13) };
}

export function looksLikeCliToken(rawToken: string): boolean {
  return CLI_TOKEN_PREFIXES.some((prefix) => rawToken.startsWith(prefix));
}

/** A short, human-verifiable code formatted as XXXX-XXXX. */
export function generateUserCode(): string {
  const pick = (): string =>
    Array.from({ length: 4 }, () =>
      USER_CODE_ALPHABET.charAt(randomInt(USER_CODE_ALPHABET.length)),
    ).join("");
  return `${pick()}-${pick()}`;
}

export function generateSessionPublicId(): string {
  return `cls_${randomBytes(16).toString("hex")}`;
}

/**
 * Authenticate an account token from an `Authorization: Bearer` header.
 * Returns the owning user, or null for missing/malformed/unknown/revoked/
 * expired tokens. Updates lastUsedAt best-effort.
 */
export async function authenticateCliToken(
  req: Request,
): Promise<{ user: User; token: CliToken } | null> {
  const header = req.headers.get("authorization") ?? "";
  const rawToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!looksLikeCliToken(rawToken)) return null;

  const token = await prisma.cliToken.findUnique({
    where: { hashedToken: hashCliToken(rawToken) },
    include: { user: true },
  });
  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt <= new Date()) return null;

  // Best-effort; never block the request on the timestamp write.
  try {
    await prisma.cliToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // ignore
  }

  const { user, ...tokenOnly } = token;
  return { user, token: tokenOnly as CliToken };
}

/** Expiry for a freshly minted account token. */
export function cliTokenExpiry(now = new Date()): Date {
  return new Date(now.getTime() + CLI_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
