import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "runtime/index": "src/runtime/index.ts",
    "cli/index": "src/cli/index.ts",
    "cli/bin": "src/cli/bin.ts",
  },
  format: ["esm"],
  target: "es2022",
  // Declarations are emitted separately by `tsc` (build:types) so we use the
  // same type-checking path as `check-types` and avoid tsup's heavier
  // rollup-based DTS worker.
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // The runtime entry must stay dependency-free and edge-safe; the CLI is
  // Node-only. Node built-ins are left external for the CLI bundle.
  shims: false,
});
