# AGENTS.md — Vaultlier / Vaultlier.js

## Project Mission

Vaultlier is a developer security product for managing application configuration through a sealed, centrally hosted vault. The core package, **`vaultlier`** (in `packages/vaultlier`), replaces the traditional `.env` workflow with a typed runtime client, CLI tooling, and a portal where teams manage environment-specific secrets without writing secret values to local disk.

The v0.1 product surface maps to three deliverables in this monorepo:

- **`apps/web`** — the client/users-facing site and portal (vaultlier.com)
- **`apps/docs`** — the public documentation portal
- **`packages/vaultlier`** — the published `vaultlier` npm library (runtime SDK + CLI + type generation)

Supporting capabilities within those surfaces:

- `npx vaultlier` CLI
- Per-project configuration vault
- `apiKey` authentication scoped by `projectId`
- Configuration lifecycle: `init → pull → push`

The goal is to give developers a safe, typed, easy workflow for reading configuration values at runtime while keeping the portal as the single source of truth across `dev`, `staging`, `prod`, and custom environments.

---

## Core Product Rules

All agents and developers must follow these rules.

1. Never write decrypted secret values to the repository.
2. Never generate `.env` files as part of the core workflow.
3. Never store vault values inside `Vaultlier.json`.
4. Treat `Vaultlier.json` as metadata only: project ID, version, environments, key schema, scopes, defaults, and types.
5. Treat `lib/Vaultlier.ts` as generated code. Do not manually edit it.
6. Runtime secret resolution must happen in memory.
7. CLI credential cache may store only the `apiKey`, never decrypted secret values.
8. All runtime code must remain edge-compatible where possible and avoid Node-only imports.
9. All public APIs must be typed end-to-end.
10. All reads and writes must be auditable.

---

## Product Architecture

### Surfaces

The repository is a **Turborepo monorepo** managed with **npm workspaces** (`apps/*`, `packages/*`). It currently scaffolds three product surfaces plus shared internal packages:

```txt
apps/web      → vaultlier.com — the client / users-facing site and portal (Next.js, :3000)
apps/docs     → public documentation portal (Next.js, :3001)
packages/vaultlier → the published `vaultlier` npm library (CLI + runtime SDK + type generation)
```

Shared internal (unpublished) packages support the above:

```txt
packages/ui                → shared React components used by web + docs
packages/eslint-config     → shared ESLint config (@repo/eslint-config)
packages/typescript-config → shared tsconfig presets (@repo/typescript-config)
```

> The backend vault API is a future surface (see Release Plan). For v0.1 it may live in `apps/web` route handlers or a dedicated package/service added later; do not assume a standalone `services/` tree exists yet.

### Expected User Flow

```bash
npm install vaultlier
npx vaultlier init
npx vaultlier pull --env=prod
npx vaultlier push --env=staging
```

During `init`, the CLI must prompt for:

```txt
apiKey
projectId
```

After successful validation, it must write:

```txt
Vaultlier.json
lib/Vaultlier.ts
```

No secret values should be written to disk.

---

## Repository Structure

This is the **current** structure. Build new product code into this layout; do not invent a parallel tree.

```txt
/
├── apps/
│   ├── web/                    # vaultlier.com — users-facing site + portal (Next.js, :3000)
│   └── docs/                   # public documentation portal (Next.js, :3001)
│
├── packages/
│   ├── vaultlier/              # ⬅ the published `vaultlier` npm library (TO BE CREATED)
│   │                           #    holds: CLI, runtime SDK, type generation, shared schema types
│   ├── ui/                     # shared React components (@repo/ui)
│   ├── eslint-config/          # shared ESLint config (@repo/eslint-config)
│   └── typescript-config/      # shared tsconfig presets (@repo/typescript-config)
│
├── turbo.json                  # Turborepo task graph
├── package.json                # npm workspaces root
├── AGENTS.md
└── README.md
```

### Planned `packages/vaultlier` internal layout

The npm library is the heart of the product. Organize it with clear public entry points so consumers can import the runtime without pulling in CLI/Node-only code:

```txt
packages/vaultlier/
├── package.json                # name: "vaultlier", exports map below
├── src/
│   ├── index.ts                # public runtime entry → createClient
│   ├── runtime/                # edge-compatible SDK (fetch + Web Crypto, no Node imports)
│   ├── cli/                    # Vaultlier CLI (init/pull/push/diff/whoami)
│   ├── generator/              # lib/Vaultlier.ts type generation
│   └── schema/                 # shared types, Vaultlier.json validation, constants
└── bin/                        # CLI entry (npx vaultlier)
```

Suggested `exports` so the runtime stays import-light:

```jsonc
{
  "name": "vaultlier",
  "exports": {
    ".": "./dist/index.js",            // runtime SDK (edge-safe)
    "./runtime": "./dist/runtime/index.js",
    "./cli": "./dist/cli/index.js"     // Node-only
  },
  "bin": { "vaultlier": "./bin/vaultlier.js" }
}
```

### Alignment plan (scaffold → product)

The repo is currently a fresh `create-turbo` scaffold. To reach the v0.1 surface:

1. **`apps/web`** — build out the users-facing site and portal pages (see Portal Agent page list). This is the source of truth UI.
2. **`apps/docs`** — populate with the documentation set (see Documentation Agent).
3. **`packages/vaultlier`** — create the published library: runtime SDK first, then CLI, then type generation.
4. Keep `@repo/ui`, `@repo/eslint-config`, `@repo/typescript-config` as the shared foundation for both apps.

---

## Agent Roles

### 1. Product Architect Agent

Responsible for preserving the overall product direction.

Scope:

- Maintain the `init → pull → push` lifecycle.
- Keep the portal as the source of truth unless a future design decision changes this.
- Ensure the developer experience remains simple and predictable.
- Resolve product questions around schema source of truth, conflict resolution, and free-tier limits.
- Keep v0.1 focused. Do not add enterprise-only features early unless required for architecture safety.

Must not:

- Introduce local `.env` generation as a normal workflow.
- Add self-hosted vault support before v1 planning.
- Add BYOK, HSM, or KMS custody into v0.1 core unless behind a future-facing interface.

---

### 2. CLI Agent

Responsible for the `vaultlier` command-line tooling, shipped inside `packages/vaultlier` (`src/cli/`, exposed via the package `bin`).

Required commands:

```bash
vaultlier init
vaultlier pull --env=<name|all>
vaultlier push --env=<name|all>
vaultlier diff --env=<name>
vaultlier whoami
```

Command responsibilities:

| Command | Responsibility |
|---|---|
| `init` | Authenticate, validate `apiKey` and `projectId`, write metadata and generated client. |
| `pull` | Fetch portal schema/config metadata and regenerate the typed client. |
| `push` | Push local schema additions to the portal after validation. |
| `diff` | Show schema differences between local and portal state. |
| `whoami` | Print current authenticated project/user context without exposing secrets. |

Exit codes:

| Code | Meaning |
|---:|---|
| `0` | Success |
| `1` | Generic error: network, parse, or IO |
| `2` | Authentication failed |
| `3` | Schema validation failed |
| `4` | Conflict between local schema and portal |

CLI implementation rules:

- Use clear errors with actionable next steps.
- Keep terminal output short and readable.
- Never print full secret values.
- Mask API keys in logs and terminal output.
- Use deterministic file generation.
- Do not overwrite user files outside the defined artifacts without confirmation.
- Validate schema before writing generated files.
- When conflict is detected, stop and instruct user to run `vaultlier diff`.

Expected successful `init` output style:

```txt
validated · 3 environments synced
wrote Vaultlier.json · lib/Vaultlier.ts
```

---

### 3. Runtime SDK Agent

Responsible for the runtime SDK imported by user applications — the default `vaultlier` export (`packages/vaultlier/src/runtime/`). Must stay edge-compatible and free of Node-only imports.

Public API target:

```ts
type VaultOptions = {
  environment: 'dev' | 'staging' | 'prod' | string;
  apiKey?: string;
  cache?: 'memory' | 'none';
  timeoutMs?: number;
};

function createClient<Schema>(
  opts: { projectId: string }
): (o: VaultOptions) => Promise<Schema>;
```

Resolution order:

1. Explicit `apiKey` passed to the runtime call.
2. `VAULTLIER_API_KEY` in the hosting or CI runtime environment.
3. Local credential cache created by `init` for development only.

Runtime targets:

- Node.js 18+
- Bun
- Deno
- Cloudflare Workers
- Vercel Edge
- AWS Lambda

Runtime implementation rules:

- Use `fetch`.
- Use Web Crypto APIs.
- Avoid Node-specific imports in the runtime package.
- Keep the runtime dependency-free unless there is a strong reason.
- Support timeout handling.
- Support memory cache and no-cache modes.
- Return typed configuration values.
- Do not expose implementation details to application code.

---

### 4. Type Generation Agent

Responsible for generating `lib/Vaultlier.ts` (logic in `packages/vaultlier/src/generator/`).

Input:

```txt
Vaultlier.json
portal schema response
```

Output:

```ts
// auto-generated — do not edit
import { createClient } from 'vaultlier';

export const vault = createClient<{
  STRIPE_SECRET: string;
  DATABASE_URL: string;
  FEATURE_NEW_FLOW: boolean;
}>({ projectId: 'prj_checkout_api' });
```

Generation rules:

- Always include an `auto-generated — do not edit` header.
- Preserve stable formatting.
- Generate valid TypeScript.
- Map Vaultlier key types to TypeScript types.
- Regenerate on every successful `pull` or `push`.
- Do not include secret values.
- Do not include API keys.
- Do not include environment-specific decrypted values.

Supported initial type mapping:

| Vault type | TypeScript type |
|---|---|
| `string` | `string` |
| `boolean` | `boolean` |
| `number` | `number` |
| `json` | `unknown` or typed object when schema is available |

---

### 5. Portal Agent

Responsible for `vaultlier.com` — the users-facing site and portal in `apps/web` (Next.js, port 3000). Shares UI primitives via `@repo/ui`.

Portal responsibilities:

- User registration and login.
- Project creation.
- Environment management.
- Key creation and editing.
- API key generation and rotation.
- Role and scope management.
- Audit log viewer.
- Billing plan management.
- Team member management.

Portal rules:

- Never display full secret values after initial entry unless explicitly designed as a secure reveal action.
- Require confirmation for destructive actions.
- Show key names, types, scopes, and version history clearly.
- Provide copyable `projectId`.
- Provide masked `apiKey` display.
- Make environment context obvious at all times.
- Provide clear `init` instructions for each project.
- Keep Hobby and Team plan flows simple for v0.1.

Recommended portal pages:

```txt
/dashboard
/projects
/projects/[projectId]
/projects/[projectId]/environments
/projects/[projectId]/keys
/projects/[projectId]/audit
/projects/[projectId]/settings
/account/api-keys
/billing
/docs
```

---

### 6. Backend API Agent

Responsible for the API consumed by CLI, portal, and runtime SDK.

Core resources:

```txt
users
organizations
projects
environments
keys
key_versions
api_keys
roles
audit_logs
```

Core API responsibilities:

- Validate API keys.
- Resolve project and environment access.
- Return schema metadata.
- Return runtime configuration securely.
- Accept schema updates from CLI.
- Record all reads and writes.
- Support versioning.
- Support conflict detection.

API rules:

- All requests must be authenticated unless explicitly public.
- Use HMAC-signed requests for official clients.
- Scope API keys by project, role, and optional IP allowlist.
- Enforce least privilege.
- Return safe error messages.
- Never log decrypted secret values.
- Always write audit records for secret reads and writes.

---

### 7. Security Agent

Responsible for encryption, auth, audit, and threat modeling.

Security requirements:

| Layer | Requirement |
|---|---|
| At rest | AES-256-GCM with per-project KEK. |
| Key rotation | Per-project KEK rotated quarterly. |
| In transit | TLS 1.3. |
| Official client | Certificate pinning where practical. |
| Auth | HMAC-signed requests. |
| Authorization | Per-environment scopes and least privilege. |
| Audit | Record actor, environment, timestamp, IP, read/write action. |
| Local | No decrypted values written to disk. |

Security rules:

- Never log raw secrets.
- Never expose full API keys in logs.
- Never include decrypted values in error objects.
- All secret access must be attributable to an actor or service identity.
- Store only encrypted secret values.
- Keep encryption and signing utilities well-tested.
- Use constant-time comparison for signatures where possible.
- Validate all input before processing.
- Treat conflict and schema validation failures as safe failures.

Out of scope for v0.1:

- Self-hosted vault deployments.
- Hardware-backed key custody.
- Native mobile SDKs.

---

### 8. Testing Agent

Responsible for test coverage and quality gates.

Required test areas:

- CLI command parsing.
- CLI authentication flow.
- `Vaultlier.json` schema validation.
- Type generation.
- Runtime SDK resolution order.
- Runtime timeout behavior.
- Runtime cache behavior.
- API key validation.
- Environment authorization.
- Encryption/decryption utilities.
- Audit log creation.
- Conflict detection.
- Error codes.

Minimum testing expectations (run from repo root via Turborepo):

```bash
npm run lint
npm run check-types
npm run build
# npm run test   ← add a `test` task to turbo.json + package workspaces (not yet wired)
```

> The scaffold ships `lint`, `build`, `dev`, `format`, and `check-types` tasks. A `test` pipeline still needs to be added to `turbo.json` and the workspace `package.json` scripts; do this when `packages/vaultlier` lands.

Testing rules:

- Do not use real secret values in tests.
- Use fake keys like `vlt_test_123`.
- Use fixtures for schemas and generated clients.
- Include integration tests for `init`, `pull`, `push`, and `diff`.
- Include regression tests for “no secret written to disk”.

---

### 9. Documentation Agent

Responsible for the documentation portal in `apps/docs` (Next.js, port 3001), plus README, examples, and onboarding.

Required docs:

```txt
Getting Started
Install & Init
Using the Runtime SDK
Managing Environments
Pulling Portal Updates
Pushing Schema Changes
Using CI / Hosting
Security Model
CLI Reference
Troubleshooting
```

Docs rules:

- Use short examples.
- Make security guarantees clear but not exaggerated.
- Always explain that `Vaultlier.json` contains metadata only.
- Always explain where `VAULTLIER_API_KEY` is used.
- Include examples for Vercel, Cloudflare Workers, and AWS Lambda.
- Include a warning not to commit API keys or secret values.
- Show how to rotate keys.
- Show how to audit access.

---

## Coding Standards

### Language

Use TypeScript across the project.

### Package manager

Use **npm workspaces** (the repo pins `npm@11.12.0` via `packageManager`). Run cross-package tasks through **Turborepo** (`npm run <task>` at the root → `turbo run <task>`). Do not introduce pnpm or yarn lockfiles.

### Style

- Use strict TypeScript.
- Avoid `any` unless justified.
- Prefer explicit return types for exported functions.
- Keep public API names stable.
- Keep CLI output consistent.
- Use small, testable modules.
- Keep security-sensitive functions isolated and heavily tested.

### Naming

Use the product naming carefully:

- `Vaultlier` for the company/product and website (vaultlier.com, served by `apps/web`).
- `vaultlier` for the published npm package name (`packages/vaultlier`), the CLI command (`npx vaultlier …`), and code imports (`import { createClient } from 'vaultlier'`).
- `Vaultlier.json` / `lib/Vaultlier.ts` for generated artifacts.
- `VAULTLIER_API_KEY` for the runtime environment variable.

---

## Generated Files Policy

The following files may be generated by the CLI:

```txt
Vaultlier.json
lib/Vaultlier.ts
```

Rules:

- `Vaultlier.json` is committed to the repository.
- `lib/Vaultlier.ts` may be committed if the team chooses, but it must remain generated.
- Neither file may contain decrypted secret values.
- Neither file may contain full API keys.
- Regeneration must be deterministic.
- Generated files must not include machine-specific paths.

---

## `Vaultlier.json` Schema Expectations

Example:

```json
{
  "projectId": "prj_checkout_api",
  "version": 3,
  "environments": ["dev", "staging", "prod"],
  "keys": {
    "STRIPE_SECRET": {
      "type": "string",
      "scopes": ["prod"]
    },
    "DATABASE_URL": {
      "type": "string",
      "scopes": ["all"]
    },
    "FEATURE_NEW_FLOW": {
      "type": "boolean",
      "default": false
    }
  }
}
```

Rules:

- `projectId` is required.
- `version` is required.
- `environments` must contain at least one environment.
- `keys` must be an object.
- Each key must define a supported `type`.
- `scopes` may be environment names or `all`.
- Defaults may be allowed for non-secret config values.
- Secret values must never be stored here.

---

## API Error Handling

Use consistent error structures.

Recommended shape:

```ts
type VaultlierError = {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};
```

Do not include:

- Raw secret values
- Full API keys
- Decrypted payloads
- Encryption keys
- Internal stack traces in production

---

## Conflict Resolution Rules

Until the conflict UX is finalized, use the safe default.

When local and portal schemas diverge:

1. Stop the operation.
2. Return exit code `4`.
3. Tell the user to run:

```bash
vaultlier diff --env=<name>
```

4. Do not overwrite portal schema silently.
5. Do not overwrite local schema silently.

---

## Release Plan Awareness

Current release direction:

| Milestone | Scope | Target |
|---|---|---|
| v0.1 public beta | `init`, `pull`, `push`, `diff`, portal, Hobby + Team plans | Q2 |
| v0.2 | Webhook deploy hooks, GitHub App, Vercel integration | Q3 |
| v0.5 | SSO + SCIM, SOC 2 Type I, audit export | Q4 |
| v1.0 | Self-hosted vault, BYOK/KMS, enterprise GA | Q1 next |

Agents must keep work aligned to the active milestone.

---

## Do Not Build Yet

Unless explicitly requested, do not implement these in v0.1:

- Self-hosted vault
- BYOK/KMS
- HSM custody
- Native mobile SDKs
- Full enterprise SSO/SCIM
- SOC 2 automation
- Complex secret sharing workflows
- `.env` export as a default workflow

---

## Required Quality Gates Before Merge

A change is not ready unless:

```bash
npm run lint
npm run check-types
npm run build
# npm run test   ← once the test pipeline exists
```

all pass successfully.

Security-sensitive changes also require:

- Unit tests
- Integration tests where applicable
- No raw secrets in logs
- No decrypted values written to disk
- Audit behavior verified

---

## Final Agent Reminder

Vaultlier exists to remove unsafe `.env` habits without making developers slower.

Every implementation decision must protect these three principles:

1. Secrets stay sealed.
2. Developer experience stays simple.
3. Runtime access stays typed, auditable, and environment-aware.
