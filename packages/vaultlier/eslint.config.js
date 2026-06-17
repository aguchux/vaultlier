import { config as base } from "@vaultlier/eslint-config/base";
import tseslint from "typescript-eslint";

/**
 * Lint setup for the published package — stricter than the repo base because
 * this code ships to npm. Type-aware rules run over `src/`; plain config
 * files skip them. The package lints with `--max-warnings 0`, so every
 * finding fails the build.
 */

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ["src/**/*.ts"],
  })),
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The CLI writes through injected streams; console bypasses capture
      // and risks leaking values in embedders.
      "no-console": "error",
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      // Unawaited promises swallow CLI errors and break exit codes.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-array-sort-compare": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests stub transports and assert on loose shapes; keep the strictness
    // that matters (floating promises) and drop the noise.
    files: ["src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/unbound-method": "off",
      // Test fakes implement async transport signatures without awaiting.
      "@typescript-eslint/require-await": "off",
    },
  },
];
