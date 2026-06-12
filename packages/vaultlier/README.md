# vaultlier

Typed runtime client, CLI, and type generation for [Vaultlier](https://vaultlier.com) - a sealed, centrally hosted configuration vault. Replaces the `.env` workflow without writing secret values to disk.

## Install

```bash
npm install vaultlier
```

## Quick start

```bash
npx vaultlier init
npx vaultlier pull --env=prod
```

`init` writes two metadata-only artifacts - `vaultlier.json` (schema) and `lib/vaultlier.ts` (generated typed client). Existing projects may also use `vaultlier.config.json` for schema metadata.

`pull`, `push`, and `diff` sync schema **metadata** (key names, types, scopes, environments - never values) with the Vaultlier portal using your API key. The portal base URL can be overridden with `--api-url=<url>` or `VAULTLIER_API_URL` for self-hosted deployments. Without an API key, `pull` falls back to regenerating from local metadata.

Generated config includes a `$schema` reference to `https://schema.vaultlier.com/v2/vaultlier.schema.json` for editor validation. **No secret values are written to disk.**

## Inspect your config locally

```bash
npx vaultlier dev   # opens a local UI on http://127.0.0.1:9090
```

`vaultlier dev` starts a read-only dashboard, bound to loopback, that shows your
project's metadata - key names, types, scopes, environments, and a masked API
key. When an API key is available (via `--api-key`, `VAULTLIER_API_KEY`, or the
local credential cache), it also fetches and displays values for the **dev
environment only**; staging and prod values are never read or displayed, and
nothing is written to disk. Without an API key the UI shows a warning and falls
back to metadata only. Use `--port=<n>` to change the port.

## Runtime usage

```ts
import { vault } from "./lib/vaultlier"; // generated client

const config = await vault({ environment: "prod" });
config.DATABASE_URL; // typed
```

Or construct a client directly:

```ts
import { createClient } from "vaultlier";

export const vault = createClient<{ DATABASE_URL: string }>({
  projectId: "prj_checkout_api",
});
```

### API key resolution order

1. Explicit `apiKey` passed to the runtime call.
2. `VAULTLIER_API_KEY` in the hosting/CI environment.
3. Local credential cache created by `vaultlier init` (development only).

## Entry points

| Import          | Surface                      | Environment                                            |
| --------------- | ---------------------------- | ------------------------------------------------------ |
| `vaultlier`     | Runtime SDK (`createClient`) | Edge-safe (Node 18+, Bun, Deno, Workers, Edge, Lambda) |
| `vaultlier/cli` | CLI programmatic API         | Node-only                                              |

The runtime entry uses only `fetch` and Web Crypto - no Node-only imports, no third-party dependencies.

## Security

- Secrets are resolved in memory and never written to disk.
- `vaultlier.json` / `vaultlier.config.json` and `lib/vaultlier.ts` contain metadata only - never secret values or API keys.
- Never commit your `VAULTLIER_API_KEY`.

## License

MIT
