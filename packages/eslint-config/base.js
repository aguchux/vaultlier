import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    // Build/output dirs are never linted. `coverage/` in particular is written
    // (and a `coverage/.tmp` scratch dir created/removed) by `test:coverage`,
    // which runs concurrently with `lint` in CI — without this ignore ESLint's
    // glob walk races that dir and crashes with ENOENT.
    ignores: ["dist/**", "coverage/**"],
  },
];
