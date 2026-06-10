# Publishing `vaultlier`

Publishes to npm with **provenance** via GitHub Actions. CI builds and publishes
the package; npm credentials stay off your machine. Repo: `aguchux/vaultlier`.

---

## One-time setup

### 1. Push the repo to GitHub

```powershell
git remote add origin https://github.com/aguchux/vaultlier.git   # if not set
git add -A
git commit -m "Add vaultlier package, security hardening, and release workflow"
git push -u origin main
```

### 2. Create an npm token

1. npmjs.com → **Access Tokens** → **Generate New Token** → **Granular Access**
   (or Classic → **Automation**).
2. Grant **read + write** publish access to `vaultlier`.
3. Copy the token.

### 3. Add the token to GitHub secrets

```powershell
gh secret set NPM_TOKEN   # paste the token when prompted
```

Or: GitHub repo → Settings → Secrets and variables → Actions → New repository
secret named `NPM_TOKEN`.

---

## Releasing a version

The `.github/workflows/release.yml` workflow triggers when a GitHub Release is
published. The tag should match the package version (`v0.1.0` → `0.1.0`).

```powershell
# 1. Make sure packages/vaultlier/package.json "version" is correct, commit it.
# 2. Cut the release (this triggers the publish workflow):
gh release create v0.1.0 --title "v0.1.0" --notes "Initial release of vaultlier"

# 3. Watch the workflow run:
gh run watch

# 4. Verify once it finishes:
npm view vaultlier
```

The npm page will show a **Provenance** badge linking to the exact commit and
workflow run that built the package.

---

## Subsequent releases

```powershell
# bump version in packages/vaultlier/package.json (e.g. 0.1.1), then:
git commit -am "vaultlier 0.1.1"
git push
gh release create v0.1.1 --title "v0.1.1" --notes "..."
```

---

## Local sanity checks (optional, no publish)

```powershell
npm run build --workspace=vaultlier
npm pack --dry-run --workspace=vaultlier   # preview tarball contents
```

## Manual publish fallback (not recommended — no provenance)

```powershell
npm login
npm publish --workspace=vaultlier --access public
```
