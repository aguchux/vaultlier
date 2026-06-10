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

```powershell
npm login
npm publish --workspace=vaultlier --access public --otp=<code>
```

### Option B: One CI publish with a bypass-2FA token

1. On npmjs.com, create a **granular access token** with publish access and
   **bypass 2FA** enabled.
2. Add it to GitHub Actions as `NPM_TOKEN`.
3. Temporarily publish with token auth.
4. Delete the token after the package exists and Trusted Publishing is enabled.

Do not use a normal publish token for CI. npm will reject it with `EOTP` when
the package/account requires a one-time password.

---
npm logout
npm login --registry=https://registry.npmjs.org/
npm whoami
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
# 1. Make sure packages/vaultlier/package.json "version" is correct, commit it.
# 2. Cut the release:
gh release create v0.1.0 --title "v0.1.0" --notes "Initial release of vaultlier"

# 3. Watch the workflow run:
gh run watch

# 4. Verify once it finishes:
npm view vaultlier
```

Trusted Publishing automatically generates npm provenance for public packages
published from public GitHub repositories.

---

## Local sanity checks

```powershell
npm run build --workspace=vaultlier
npm pack --dry-run --workspace=vaultlier
```
