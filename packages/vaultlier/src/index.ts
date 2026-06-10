/**
 * vaultlier — public entry point.
 *
 * The default export surface is the edge-safe runtime SDK. Node-only tooling
 * (the CLI) is exposed via the `vaultlier/cli` subpath, and the generator is
 * an internal build-time utility consumed by the CLI.
 */

export {
  createClient,
  VaultlierRuntimeError,
  type VaultOptions,
  type ClientConfig,
  type VaultClient,
} from "./runtime/index.js";

export {
  type VaultlierConfig,
  type VaultKeySchema,
  type VaultKeyType,
  type VaultScope,
  type VaultlierError,
  API_KEY_ENV,
} from "./schema/types.js";

export { maskSecret, redact, REDACTED } from "./schema/security.js";
