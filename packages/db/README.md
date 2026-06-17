# @vaultlier/db

Shared Prisma client and database schema for the Vaultlier backend. Consumed by
`apps/web` (portal) and any future API service.

## Setup

1. Provision Postgres and set `DATABASE_URL` (see `.env.example`):

   ```bash
   cp .env.example .env   # then edit DATABASE_URL
   ```

2. Generate the client and run migrations:

   ```bash
   npm run db:generate --workspace=@vaultlier/db
   npm run db:migrate  --workspace=@vaultlier/db   # creates + applies a dev migration
   npm run db:seed     --workspace=@vaultlier/db   # optional demo data
   ```

## Usage

```ts
import { prisma } from "@vaultlier/db";

const projects = await prisma.project.findMany();
```

A global singleton is reused across hot reloads and warm serverless invocations
to avoid exhausting connections.

## Scripts

| Script | Purpose |
| --- | --- |
| `db:generate` | Generate the Prisma client into `generated/client`. |
| `db:migrate` | Create and apply a dev migration. |
| `db:deploy` | Apply migrations in CI/production (`migrate deploy`). |
| `db:push` | Push schema without a migration (prototyping). |
| `db:studio` | Open Prisma Studio. |
| `db:seed` | Seed demo data. |

## Model

Identity/tenancy (`User`, `Organization`, `Membership`), projects
(`Project`, `Environment`), keys (`Key`, `KeyVersion`), access (`ApiKey`,
`Role`), and `AuditLog`. See [`prisma/schema.prisma`](prisma/schema.prisma).

### Security

- **Secret values are never stored in plaintext.** `KeyVersion` holds only
  AES-256-GCM `ciphertext` + `nonce` + `authTag`; encryption happens in the
  vault layer.
- **API keys are stored hashed** (`hashedKey`) with a display-only `prefix`.
  The raw key is shown once and never persisted.
- **`AuditLog` is append-only** and never contains secret values.
