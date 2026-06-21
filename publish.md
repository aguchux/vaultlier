# Publishing `vaultlier`

Publishes the `vaultlier` package to npm from GitHub Actions. The release
workflow is configured for npm Trusted Publishing, which uses GitHub OIDC
instead of a long-lived npm publish token.

Repo: `aguchux/vaultlier`
Workflow: `.github/workflows/release.yml`

---

## One-time bootstrap

Trusted Publishing can only be configured after the package exists on npm. For
the first publish of `vaultlier`, use one of these bootstrap paths:

### Option A: Manual first publish

Run from the `vaultlier/` package directory:

```powershell
npm login
npm run build
npm publish
```

`publishConfig.access` is already `public`, so `--access public` is not needed.
If npm prompts for 2FA, append `--otp=<code>`.

### Option B: One CI publish with a bypass-2FA token

1. On npmjs.com, create a **granular access token** with publish access and
   **bypass 2FA** enabled.
2. Add it to GitHub Actions as `NPM_TOKEN`.
3. Temporarily publish with token auth.
4. Delete the token after the package exists and Trusted Publishing is enabled.

Do not use a normal publish token for CI. npm will reject it with `EOTP` when
the package/account requires a one-time password.

---

## Enable Trusted Publishing

After `vaultlier` exists on npm:

1. Open npmjs.com -> package `vaultlier` -> Settings -> Trusted Publisher.
2. Select **GitHub Actions**.
3. Configure:
   - Organization/user: `aguchux`
   - Repository: `vaultlier`
   - Workflow filename: `release.yml`
   - Environment: leave blank unless the workflow uses a GitHub environment
   - Allowed action: `npm publish`
4. Save the trusted publisher.
5. Remove any `NPM_TOKEN` secret that is no longer needed.

The workflow already has `id-token: write`, which npm requires for OIDC.

---

## Releasing a version

The workflow triggers when a GitHub Release is published. The tag should match
the package version (`v0.1.0` -> `0.1.0`).

```powershell
# 1. Bump package.json and package-lock.json.
npm run version:patch

# For other bump types:
# npm run version:minor
# npm run version:major
# npm run version:vaultlier -- 0.2.3

# 2. Commit the version bump.
git add package.json package-lock.json
git commit -m "Release vaultlier 0.1.24"
git push

# 3. Cut the release with a tag matching the new package version:
gh release create v0.1.24 --title "v0.1.24" --notes "Release vaultlier 0.1.24"

# 4. Watch the workflow run:
gh run watch

# 5. Verify once it finishes:
npm view vaultlier

```

Trusted Publishing automatically generates npm provenance for public packages
published from public GitHub repositories.

---

## Database migrations (`@vaultlier/db`)

Migrations are applied by `.github/workflows/db-deploy.yml`, which runs
`prisma migrate deploy` (apply-only — never creates or resets). It triggers on
pushes to `main` that touch `packages/db/prisma/**`, and via manual dispatch.

### One-time setup

1. GitHub repo -> Settings -> Environments -> create **`production`**.
   - Add a secret **`DATABASE_URL`** (the production Postgres connection string).
   - Optional: add required reviewers / a wait timer to gate deploys.
2. Author migrations locally against a dev database, then commit them
   (run from the `website/` monorepo root, where `@vaultlier/db` is a workspace):

   ```powershell
   # set DATABASE_URL in packages/db/.env first
   npm run db:migrate --workspace=@vaultlier/db   # creates packages/db/prisma/migrations/*
   git add packages/db/prisma/migrations
   git commit -m "db: <migration name>"
   git push   # main push triggers db-deploy.yml -> migrate deploy
   ```

The workflow no-ops until at least one migration is committed.

---

## Local sanity checks

Run from the `vaultlier/` package directory:

```powershell
npm run build
npm pack --dry-run
```
