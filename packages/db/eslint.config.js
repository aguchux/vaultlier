import { config } from "@vaultlier/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    ignores: ["generated/**"],
  },
];
