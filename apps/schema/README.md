# schema — schema.vaultlier.com

Next.js app that hosts the JSON Schema for the Vaultlier config file
(`vaultlier.json` / `vaultlier.config.json`).

## Endpoints

| Path | Description |
| --- | --- |
| `/v2/vaultlier.schema.json` | Canonical v2 schema (use this as `$schema`). |
| `/v2/latest/vaultlier.schema.json` | Alias tracking the newest v2 schema. |
| `/v2` → schema | Redirects to the canonical document. |
| `/` | Landing page with usage docs. |

Canonical `$id`: `https://schema.vaultlier.com/v2/vaultlier.schema.json`

## Source of truth

The schema lives in [`app/v2/schema.ts`](app/v2/schema.ts) and mirrors the
`VaultlierConfig` type and `validateConfig` rules in the `vaultlier` package.
When the config shape changes, update both. Breaking changes get a new major
path (`/v3/*`); additive changes stay in `/v2`.

## Develop

```bash
npm run dev --workspace=schema   # http://localhost:3002
```

## Deploy

Point the `schema.vaultlier.com` domain at this app. Routes are statically
rendered and long-cached.
