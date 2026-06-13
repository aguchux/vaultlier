/**
 * Vaultlier runtime SDK.
 *
 * Edge-compatible: uses only `fetch` and standard globals. No Node-only
 * imports, no third-party dependencies. Runs on Node 18+, Bun, Deno,
 * Cloudflare Workers, Vercel Edge, and AWS Lambda.
 *
 * Secret resolution happens in memory. Decrypted values are never written
 * to disk and never logged.
 */

import { API_KEY_ENV } from "../schema/types.js";
import { looksLikeApiKey } from "../schema/security.js";

export interface VaultOptions {
  environment: "dev" | "staging" | "prod" | (string & {});
  /** Explicit API key. Takes precedence over the environment variable. */
  apiKey?: string;
  /** `"memory"` caches resolved config in this process. Defaults to memory. */
  cache?: "memory" | "none";
  /** Memory-cache lifetime in milliseconds. Defaults to 60000. */
  cacheTtlMs?: number;
  /** Request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number;
}

export interface ClientConfig {
  projectId: string;
  /** Override the vault API base URL (primarily for testing). */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.vaultlier.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 64;

interface CacheEntry<Schema> {
  value: Schema;
  cachedAt: number;
  expiresAt: number;
}

/** Resolved client function: call with options, receive typed config. */
export type VaultClient<Schema> = (opts: VaultOptions) => Promise<Schema>;

/**
 * Create a typed vault client for a project. The returned function fetches and
 * resolves configuration for a given environment.
 *
 * @example
 * export const vault = createClient<{ DATABASE_URL: string }>({
 *   projectId: "prj_checkout_api",
 * });
 * const config = await vault({ environment: "prod" });
 */
export function createClient<Schema>(
  config: ClientConfig,
): VaultClient<Schema> {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const memoryCache = new Map<string, CacheEntry<Schema>>();
  const inFlight = new Map<string, Promise<Schema>>();

  return async (opts: VaultOptions): Promise<Schema> => {
    const apiKey = resolveApiKey(opts.apiKey);
    if (!apiKey) {
      throw new VaultlierRuntimeError(
        "auth/missing_api_key",
        `No API key found. Pass \`apiKey\` or set ${API_KEY_ENV}.`,
      );
    }
    if (!looksLikeApiKey(apiKey)) {
      // Reject malformed keys locally so we never place garbage in an
      // Authorization header — and never echo the value back in the message.
      throw new VaultlierRuntimeError(
        "auth/invalid_api_key",
        `The provided API key is malformed (expected a "vlt_" key).`,
      );
    }

    const useCache = opts.cache !== "none";
    if (!useCache) {
      return fetchConfig<Schema>({
        baseUrl,
        projectId: config.projectId,
        environment: opts.environment,
        apiKey,
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
    }

    const cacheTtlMs = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    if (!Number.isFinite(cacheTtlMs) || cacheTtlMs < 0) {
      throw new VaultlierRuntimeError(
        "cache/invalid_ttl",
        "cacheTtlMs must be a finite, non-negative number.",
      );
    }

    const cacheKey = `${opts.environment}:${await fingerprintApiKey(apiKey)}`;
    const now = Date.now();
    pruneExpiredEntries(memoryCache, now);
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.cachedAt + cacheTtlMs > now) return cached.value;

    const pending = inFlight.get(cacheKey);
    if (pending) return pending;

    const request = fetchConfig<Schema>({
      baseUrl,
      projectId: config.projectId,
      environment: opts.environment,
      apiKey,
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }).then((result) => {
      if (cacheTtlMs > 0) {
        if (
          !memoryCache.has(cacheKey) &&
          memoryCache.size >= MAX_CACHE_ENTRIES
        ) {
          const oldestKey = memoryCache.keys().next().value;
          if (oldestKey !== undefined) memoryCache.delete(oldestKey);
        }
        const cachedAt = Date.now();
        memoryCache.set(cacheKey, {
          value: result,
          cachedAt,
          expiresAt: cachedAt + cacheTtlMs,
        });
      }
      return result;
    });

    inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      inFlight.delete(cacheKey);
    }
  };
}

async function fingerprintApiKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function pruneExpiredEntries<Schema>(
  cache: Map<string, CacheEntry<Schema>>,
  now: number,
): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

/**
 * Error thrown by the runtime. Carries only a stable `code`, a safe `message`,
 * and an optional `requestId` — never an API key, header, URL with
 * credentials, or decrypted value. `toJSON` constrains what structured loggers
 * can serialize.
 */
export class VaultlierRuntimeError extends Error {
  readonly code: string;
  readonly requestId?: string;

  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.name = "VaultlierRuntimeError";
    this.code = code;
    this.requestId = requestId;
  }

  /** Only safe fields are serialized — guards against accidental leakage. */
  toJSON(): {
    name: string;
    code: string;
    message: string;
    requestId?: string;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      requestId: this.requestId,
    };
  }
}

interface FetchParams {
  baseUrl: string;
  projectId: string;
  environment: string;
  apiKey: string;
  timeoutMs: number;
}

async function fetchConfig<Schema>(params: FetchParams): Promise<Schema> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const url =
      `${params.baseUrl}/v1/projects/${encodeURIComponent(params.projectId)}` +
      `/config?environment=${encodeURIComponent(params.environment)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${params.apiKey}`,
        accept: "application/json",
      },
      signal: controller.signal,
    });

    const requestId = res.headers.get("x-request-id") ?? undefined;

    if (!res.ok) {
      throw new VaultlierRuntimeError(
        `http/${res.status}`,
        `Vaultlier request failed with status ${res.status}`,
        requestId,
      );
    }

    return (await res.json()) as Schema;
  } catch (err) {
    if (err instanceof VaultlierRuntimeError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new VaultlierRuntimeError(
        "network/timeout",
        `Vaultlier request timed out after ${params.timeoutMs}ms`,
      );
    }
    throw new VaultlierRuntimeError(
      "network/error",
      `Vaultlier request failed: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolution order:
 * 1. Explicit `apiKey` argument.
 * 2. `VAULTLIER_API_KEY` from the runtime environment.
 * 3. (Dev only) local credential cache created by the CLI — resolved by the
 *    CLI layer, not here, to keep this module edge-safe.
 */
function resolveApiKey(explicit?: string): string | undefined {
  if (explicit) return explicit;
  const env = (globalThis as { process?: { env?: Record<string, string> } })
    .process?.env;
  return env?.[API_KEY_ENV];
}
