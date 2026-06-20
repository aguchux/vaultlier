# Contributing to vaultlier

Thanks for helping. This package is the published npm surface of Vaultlier
(runtime SDK + CLI), so it is held to strict standards. CI enforces everything
below on every pull request; running the same commands locally first saves you
a round trip.

## Setup

```bash
npm ci
```

## Quality gates

| Command                 | What it checks                                              |
| ----------------------- | ----------------------------------------------------------- |
| `npm run lint`          | ESLint with type-aware rules, `--max-warnings 0`            |
| `npm run check-types`   | `tsc --noEmit` over the whole package                       |
| `npm run test`          | Vitest suite (`npm run test:watch` while developing)        |
| `npm run test:coverage` | Tests + coverage thresholds (statements/branches/functions) |
| `npm run build`         | tsup bundle + `.d.ts` emit must succeed                     |

CI should run these on Node 18/20/22 (Linux) and Node 22 (Windows). The
minimum supported Node version is declared in `engines`; do not use APIs newer
than that without raising it deliberately.

## Ground rules

- **Zero runtime dependencies.** Everything in `src/` ships to npm with no
  third-party packages. If you need a utility, write the minimal version
  (see `src/cli/ui.ts` for the pattern). Dev dependencies are fine.
- **Secret values never touch disk or logs.** No secret value may be written
  to a file, echoed to stdout/stderr, embedded in an error message, or stored
  in a snapshot. Masking helpers live in `src/schema/security.ts`. Tests assert
  this; keep them passing and add the same assertions for new surfaces.
- **`src/runtime/` stays edge-safe.** Only `fetch` and standard globals; no
  Node-specific imports. Node-only code belongs in `src/cli/`.
- **Tests accompany behavior changes.** New commands, flags, or error paths
  need tests in the matching `*.test.ts`. Coverage thresholds in
  `vitest.config.ts` are floors; raise them when coverage grows, never lower
  them to merge.
- **CLI output conventions.** Write through the injected `ctx` streams (never
  `console.*`; lint blocks it), use `ctx.ui` for status lines and spinners,
  and keep stdout machine-readable (spinners render on stderr).

## Releases

Maintainers publish by creating a GitHub Release whose tag matches the package
version, either `0.1.20` or `v0.1.20` style. The release workflow re-verifies
the package and publishes via npm Trusted Publishing with provenance. If that
exact package version already exists on npm, the workflow skips publish instead
of attempting a duplicate publish. Contributors do not need to touch versioning.
