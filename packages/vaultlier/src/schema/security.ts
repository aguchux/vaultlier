/**
 * Security utilities shared across the runtime SDK and CLI.
 *
 * Edge-safe and dependency-free. These helpers exist to make the
 * "secrets never leak" guarantee enforceable in one place:
 *
 *  - {@link maskSecret} for any value shown to a human.
 *  - {@link redact} for objects that may be logged or serialized.
 *  - {@link safeEqual} for comparing secrets without timing leaks.
 *
 * Decrypted secret values are never written to disk and never logged.
 */

/** Patterns whose VALUES must be redacted when logging objects. */
const SENSITIVE_KEY_PATTERN =
  /(api[-_]?key|secret|token|password|passwd|authorization|auth|credential|private[-_]?key|session|cookie|bearer)/i;

/** Replacement used everywhere a secret value is removed. */
export const REDACTED = "[redacted]";

/**
 * Mask a secret for display: keep a short, non-sensitive prefix and the last
 * two characters so it can be visually correlated, hide everything else.
 * Short values are fully masked.
 *
 * @example maskSecret("vlt_live_1234567890") // "vlt_live…90"
 */
export function maskSecret(value: string, prefixLength = 8): string {
  if (typeof value !== "string" || value.length === 0) return REDACTED;
  if (value.length <= prefixLength + 2) return "****";
  return `${value.slice(0, prefixLength)}…${value.slice(-2)}`;
}

/**
 * Deep-clone an object with the values of sensitive-looking keys replaced by
 * {@link REDACTED}. Use before logging or including anything in an error.
 * Cycles are handled; non-plain values are returned as-is.
 */
export function redact<T>(input: T, seen = new WeakSet<object>()): T {
  if (input === null || typeof input !== "object") return input;
  if (seen.has(input as object)) return input;
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((item) => redact(item, seen)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(value, seen);
  }
  return out as T;
}

/**
 * Constant-time string comparison. Returns `false` for length mismatches
 * without short-circuiting on content, avoiding timing side channels when
 * comparing API keys or signatures.
 */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  // Compare against a fixed length so the loop count does not depend on the
  // secret's length. Length inequality still yields false.
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}

/**
 * Assert that a string looks like a Vaultlier API key. Does not validate it
 * against the server; only guards against obviously malformed input before it
 * is placed in an Authorization header.
 */
export function looksLikeApiKey(value: unknown): value is string {
  return typeof value === "string" && /^vlt_[A-Za-z0-9_]{8,}$/.test(value);
}
