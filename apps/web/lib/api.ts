/**
 * Machine API (v1) plumbing: bearer-key authentication, the standard error
 * shape ({ code, message, requestId } — mirrored by the vaultlier SDK's
 * VaultlierError), request IDs, and IP allowlist enforcement.
 *
 * API keys are presented as `Authorization: Bearer vlt_...` and stored only
 * as SHA-256 hashes; lookup is by hash, so raw keys never touch the database.
 */

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@vaultlier/db";
import type { ApiKey, Project, Role } from "@vaultlier/db";

const API_KEY_PATTERN = /^vlt_[A-Za-z0-9_]{8,}$/;
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export interface ApiContext {
  requestId: string;
  project: Project;
  apiKey: ApiKey;
  ipAddress: string | null;
}

export type AuthResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; response: NextResponse };

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/** Generate a new raw API key. Returned once; only the hash is stored. */
export function generateApiKey(): { rawKey: string; prefix: string } {
  const rawKey = `vlt_live_${randomBytes(24).toString("hex")}`;
  return { rawKey, prefix: rawKey.slice(0, 13) };
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function apiJson(
  requestId: string,
  body: unknown,
  init: { status?: number } = {},
): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { "x-request-id": requestId, "cache-control": "no-store" },
  });
}

export function apiError(
  requestId: string,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return apiJson(requestId, { code, message, requestId }, { status });
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

/**
 * Authenticate a v1 request against a project (by public id, e.g. prj_xxx).
 * Verifies the key exists, is not revoked/expired, belongs to that project,
 * passes the IP allowlist, and carries at least `minRole`.
 */
export async function authenticate(
  req: Request,
  publicProjectId: string,
  minRole: Role = "VIEWER",
): Promise<AuthResult> {
  const requestId = newRequestId();
  const fail = (status: number, code: string, message: string): AuthResult => ({
    ok: false,
    response: apiError(requestId, status, code, message),
  });

  const header = req.headers.get("authorization") ?? "";
  const rawKey = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!API_KEY_PATTERN.test(rawKey)) {
    return fail(401, "auth/missing_api_key", "Missing or malformed API key.");
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { hashedKey: hashApiKey(rawKey) },
    include: { project: true },
  });
  // One generic message for unknown/revoked/expired/mismatched keys so the
  // endpoint doesn't reveal which projects or keys exist.
  const denied = fail(401, "auth/invalid_api_key", "Invalid API key.");
  if (!apiKey) return denied;
  if (apiKey.revokedAt) return denied;
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return denied;
  if (apiKey.project.publicId !== publicProjectId) return denied;

  const ipAddress = clientIp(req);
  if (apiKey.ipAllowlist.length > 0) {
    if (!ipAddress || !ipAllowed(ipAddress, apiKey.ipAllowlist)) {
      return fail(403, "auth/ip_not_allowed", "Request IP is not allowed.");
    }
  }

  if (ROLE_RANK[apiKey.role] < ROLE_RANK[minRole]) {
    return fail(
      403,
      "auth/insufficient_role",
      `This API key's role (${apiKey.role.toLowerCase()}) cannot perform this operation.`,
    );
  }

  // Best-effort usage timestamp; never block the request on it.
  try {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // ignore
  }

  const { project, ...keyOnly } = apiKey;
  return {
    ok: true,
    ctx: { requestId, project, apiKey: keyOnly as ApiKey, ipAddress },
  };
}

/** Entry matches when it equals the IP or is an IPv4 CIDR containing it. */
function ipAllowed(ip: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => {
    if (entry === ip) return true;
    if (entry.includes("/")) return ipv4InCidr(ip, entry);
    return false;
  });
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const ipNum = ipv4ToNumber(ip);
  const netNum = ipv4ToNumber(network ?? "");
  if (ipNum === null || netNum === null) return false;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}
