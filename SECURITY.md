# Security Model — vaultlier

Vaultlier replaces the `.env` workflow without writing secret values to disk. This document states the guarantees the `vaultlier` package makes and how to report issues.

## Guarantees

1. **No secrets on disk.** Decrypted secret values are never written to the
   filesystem by the runtime or CLI. The generated artifacts — `vaultlier.json`
   or `vaultlier.config.json` (metadata) and the optional typed client
   (`lib/vaultlier/vaultlier.ts` by default) — contain key names, types, and
   scopes only.
2. **In-memory resolution.** Runtime secret resolution happens in memory. The
   default `cache: "memory"` mode keeps values only in the current process, is
   partitioned by environment and API-key fingerprint, and expires entries
   after 60 seconds by default. Concurrent reads share one in-flight request.
   Values are never placed in a CDN, browser cache, database, or shared cache.
3. **API keys are masked, never logged.** Use `maskSecret` for any human-facing
   display and `redact` before logging objects. `VaultlierRuntimeError` exposes
   only `{ name, code, message, requestId }` via `toJSON` — never a key, header,
   or decrypted value.
4. **Keys are validated locally.** Malformed keys are rejected before they reach
   an `Authorization` header (`looksLikeApiKey`), and the rejected value is never
   echoed back.
5. **Constant-time comparison.** `safeEqual` compares secrets/signatures without
   content-dependent short-circuiting.
6. **Edge-safe runtime.** The runtime entry uses only `fetch` and standard
   globals — no Node-only imports and no third-party dependencies — reducing
   supply-chain surface.

## API key resolution order

1. Explicit `apiKey` passed to the runtime call.
2. `VAULTLIER_API_KEY` from the hosting/CI environment.
3. (Development only) local credential cache created by `vaultlier init`,
   resolved by the CLI layer. This cache may store **only** the `apiKey` —
   never decrypted secret values.

## What you must do

- **Never commit** `VAULTLIER_API_KEY`, `.env` files, `.vaultlier/` caches,
  or any key material. The repository `.gitignore` blocks these by default.
- Set `VAULTLIER_API_KEY` via your host/CI secret store, not in source.
- Rotate API keys regularly; scope them by project and environment.
- Keep `cacheTtlMs` short enough for your revocation requirements. Use
  `cache: "none"` where every read must be re-authorized immediately.

## Helpers exported for safe handling

| Export              | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `maskSecret(value)` | Mask a secret for display.                 |
| `redact(obj)`       | Deep-redact sensitive keys before logging. |
| `REDACTED`          | The replacement marker (`[redacted]`).     |

## Reporting a vulnerability

Email **security@vaultlier.com** with details and reproduction steps. Please do
not open public issues for security reports. We aim to acknowledge within 2
business days.
