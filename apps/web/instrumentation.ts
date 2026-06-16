/**
 * Server startup checks. Next.js calls `register()` once per server process
 * before handling requests, so this is where we fail fast on a misconfigured
 * deployment instead of crashing deep inside the first secret read/write.
 */

export async function register(): Promise<void> {
  // Only the Node.js server runtime owns the vault master key and can read or
  // write secret values; the Edge runtime never touches it.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Imported lazily so the Edge bundle never pulls in node:crypto.
  const { assertVaultConfigured } = await import("./lib/vault-crypto");
  try {
    assertVaultConfigured();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Loud, unambiguous, and fatal: a portal that can't seal/unseal secrets is
    // not safe to serve. The message includes how to generate a valid key.
    console.error(
      `\n[vaultlier] FATAL: ${message}\n` +
        `[vaultlier] The portal cannot encrypt or decrypt secret values without a ` +
        `valid VAULT_MASTER_KEY. Generate one with \`vaultlier generate-key\` (or ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") ` +
        `and set it in the server environment.\n`,
    );
    // Refuse to start. In serverless this fails the cold start, surfacing the
    // misconfiguration immediately rather than as random 500s later.
    throw new Error("VAULT_MASTER_KEY is not configured");
  }
}
