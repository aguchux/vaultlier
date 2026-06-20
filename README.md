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

`init` walks a new developer through the whole setup: it installs the
dependency if needed, offers a browser login when you have no account
credentials yet, lets you pick an existing project with the arrow keys (or
create a new one), and asks for an API key - **press Enter to skip** if you
don't have one yet. It always writes the metadata-only `vaultlier.json`
(schema), and **optionally** generates a typed SDK client. When you accept the
prompt, the client is generated at `lib/vaultlier/vaultlier.ts` by default
(override with `--client=<path>`); decline (or pass `--no-client`) to wire the
SDK by hand with `import { createClient } from 'vaultlier'`. The chosen path is
recorded in `vaultlier.json` (`"client"`), so later commands only regenerate
the client when you opted in. Existing projects may also use
`vaultlier.config.json` for schema metadata. Fully non-interactive setup still
works: `npx vaultlier init --project-id=<id> --api-key=<key>`
(generates the client unless `--no-client` is passed).

## Login and account

```bash
npx vaultlier login    # prints a URL + code; approve it in the browser
npx vaultlier logout   # removes the locally stored account token
```

`login` uses the device-code flow: the CLI shows a verification link and a
short code, you approve it in the browser, and the CLI receives an account
token. The token is stored per-user in `~/.vaultlier/auth.json` (owner-only
permissions), never inside a repository, and only authorizes account
operations such as listing and creating projects - it is not a project API
key and cannot read secrets.

## Local configuration

```bash
npx vaultlier config set project=prj_29ec67d64dd1
npx vaultlier config set apiKey=vlt_live_...
npx vaultlier config get      # current settings, API key masked
npx vaultlier config verify   # re-validates the project id + key with the portal
```

`config set project=...` updates `vaultlier.json` and regenerates the typed
client when one was generated; `config set apiKey=...` updates only the local credential cache and
never prints the key back. You can skip storing a key entirely and set
`VAULTLIER_API_KEY` in the environment instead - the CLI and runtime resolve
it automatically.

`pull`, `push`, and `diff` sync schema **metadata** (key names, types, scopes, environments - never values) with the Vaultlier portal using your API key. The portal base URL can be overridden with `--api-url=<url>` or `VAULTLIER_API_URL` for self-hosted deployments. Without an API key, `pull` falls back to regenerating from local metadata.

Generated config includes a `$schema` reference to `https://schema.vaultlier.com/v2/vaultlier.schema.json` for editor validation. **No secret values are written to disk.**

## Set secret values

```bash
npx vaultlier set DATABASE_URL=postgres://prod-db/main --env=prod
npx vaultlier set STRIPE_SECRET=sk_live_... FEATURE_NEW_FLOW=true -e prod
```

`set` writes one or more `KEY=VALUE` pairs to a single environment. Keys must
already exist in the schema (`vaultlier push` first) and be scoped to the
target environment - both are checked locally before any value leaves your
machine. Values are sealed server-side as new immutable versions; the CLI
prints the new version numbers and never echoes the values back. Requires an
API key with the member role or higher.

If the target environment does not exist yet, `set` offers to create it (pass
`--yes` to skip the prompt, e.g. in CI):

```bash
npx vaultlier set DATABASE_URL=postgres://wip-db --env=working --yes
```

This declares the environment through an additive schema push (nothing is
deleted), adopts the synced schema into `vaultlier.json`, then writes the
values against the new environment. An environment that exists locally but not
in the portal is synced the same way automatically.

## Remove secret values

```bash
npx vaultlier unset DATABASE_URL --env=prod
npx vaultlier unset STRIPE_SECRET FEATURE_NEW_FLOW --env=prod --yes
```

`unset` is the counterpart to `set`: it removes the stored **values** for one or
more keys from a single environment. The schema metadata (key names, types,
scopes) is left intact, so the keys can be re-set later. Because removal is
unrecoverable, `unset` confirms before deleting unless you pass `--yes` (e.g. in
CI). Values are never read, printed, or written to disk; a `KEY=VALUE` argument
is accepted but the value is ignored, so a `set` line can be reused. The CLI
reports which keys were removed (and which were not set). Requires an API key
with the member role or higher.

## CLI output

Commands print status-prefixed lines (check/warning/cross) and show a spinner
while talking to the portal. Styling is zero-dependency and degrades
gracefully: colors and the spinner activate only on an interactive terminal
and are suppressed when output is piped or `CI` is set, so logs stay plain.
`NO_COLOR` disables colors; `FORCE_COLOR` forces them. Spinners render on
stderr, keeping stdout clean for scripting.

## CLI flag conventions

Every value flag has a canonical `--kebab-case` long form; common ones also
have a single-letter short form. Both `--flag=value` and `--flag value` work.

| Short | Long           | Aliases         | Used by                                |
| ----- | -------------- | --------------- | -------------------------------------- |
| `-e`  | `--env`        | `--environment` | `pull`, `push`, `diff`, `set`, `unset` |
| `-k`  | `--api-key`    | `--apiKey`      | all portal commands                    |
|       | `--api-url`    | `--apiUrl`      | all portal commands                    |
|       | `--project-id` | `--projectId`   | `init`                                 |
| `-p`  | `--port`       |                 | `dev`                                  |
| `-o`  | `--output`     |                 | `--generate`, `--generate-env`         |
|       | `--client`     |                 | `init`                                 |
|       | `--no-client`  |                 | `init`                                 |
| `-g`  | `--generate`   |                 | standalone                             |
| `-y`  | `--yes`        |                 | prompts                                |
| `-f`  | `--force`      |                 | `init`, generated `.env`               |
| `-h`  | `--help`       |                 | everywhere                             |

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
import { vault } from "./lib/vaultlier/vaultlier"; // generated client

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
- `vaultlier.json` / `vaultlier.config.json` and the generated client (`lib/vaultlier/vaultlier.ts` by default, when enabled) contain metadata only - never secret values or API keys.
- Never commit your `VAULTLIER_API_KEY`.

## License

MIT
