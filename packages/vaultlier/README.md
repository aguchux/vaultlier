# vaultlier

Typed runtime client, CLI, and type generation for [Vaultlier](https://vaultlier.com) — a sealed, centrally hosted configuration vault. Replaces the `.env` workflow without writing secret values to disk.

## Install

```bash
npm install vaultlier
```

## Quick start

```bash
npx vaultlier init
npx vaultlier pull --env=prod
```

`init` writes two metadata-only artifacts — `vaultlier.json` (schema) and `lib/Vaultlier.ts` (generated typed client). Existing projects may also use `vaultlier.config.json` for schema metadata. **No secret values are written to disk.**

## Runtime usage

```ts
import { vault } from "./lib/Vaultlier"; // generated client

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

The runtime entry uses only `fetch` and Web Crypto — no Node-only imports, no third-party dependencies.

## Security

- Secrets are resolved in memory and never written to disk.
- `vaultlier.json` / `vaultlier.config.json` and `lib/Vaultlier.ts` contain metadata only — never secret values or API keys.
- Never commit your `VAULTLIER_API_KEY`.

## License

MIT
