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

const DEFAULT_BASE_URL = "https://vaultlier.com";
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
  const bytes = new TextEncoder().encode(apiKey);
  const subtle = globalThis.crypto?.subtle;

  if (subtle) {
    const digest = await subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest));
  }

  return sha256Hex(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

const SHA256_INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
] as const;

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function sha256Hex(message: Uint8Array): string {
  const bitLength = message.length * 8;
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;

  const lengthOffset = paddedLength - 8;
  const view = new DataView(padded.buffer);
  view.setUint32(lengthOffset, Math.floor(bitLength / 0x100000000));
  view.setUint32(lengthOffset + 4, bitLength >>> 0);

  const hash: number[] = [...SHA256_INITIAL_HASH];
  const words = new Array<number>(64).fill(0);

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) {
      words[i] =
        ((padded[chunk + i * 4] ?? 0) << 24) |
        ((padded[chunk + i * 4 + 1] ?? 0) << 16) |
        ((padded[chunk + i * 4 + 2] ?? 0) << 8) |
        (padded[chunk + i * 4 + 3] ?? 0);
    }

    for (let i = 16; i < 64; i += 1) {
      const word2 = words[i - 2] ?? 0;
      const word7 = words[i - 7] ?? 0;
      const word15 = words[i - 15] ?? 0;
      const word16 = words[i - 16] ?? 0;
      const sigma0 =
        rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 =
        rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[i] = (word16 + sigma0 + word7 + sigma1) >>> 0;
    }

    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;

    for (let i = 0; i < 64; i += 1) {
      const bigSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 =
        (h +
          bigSigma1 +
          choice +
          (SHA256_ROUND_CONSTANTS[i] ?? 0) +
          (words[i] ?? 0)) >>>
        0;
      const bigSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (bigSigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
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
