import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        // Pure re-export entry points and the bin shim: no logic to cover.
        "src/index.ts",
        "src/schema/index.ts",
        "src/cli/bin.ts",
      ],
      reporter: ["text", "lcov"],
      // Floors, not targets — raise them as coverage grows; never lower them
      // to merge. CI fails when a change drops coverage below these.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 90,
        lines: 80,
      },
    },
  },
});
