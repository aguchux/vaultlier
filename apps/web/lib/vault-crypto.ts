/**
 * Vault encryption layer.
 *
 * Secret values are sealed with AES-256-GCM using a per-project KEK derived
 * via HKDF-SHA256 from a single master key (VAULT_MASTER_KEY, 32 bytes,
 * base64). The database only ever sees ciphertext + nonce + auth tag.
 *
 * `kekId` names the master-key generation ("mk1", "mk2", ...) so the master
 * key can be rotated: new writes use CURRENT_KEK_ID while old versions still
 * decrypt with the generation recorded on the row.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const CURRENT_KEK_ID = "mk1";
const NONCE_BYTES = 12;

export interface SealedValue {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  kekId: string;
}

function masterKey(kekId: string): Buffer {
  // Future generations would read VAULT_MASTER_KEY_MK2 etc.; mk1 is the
  // canonical VAULT_MASTER_KEY.
  const envName =
    kekId === CURRENT_KEK_ID
      ? "VAULT_MASTER_KEY"
      : `VAULT_MASTER_KEY_${kekId.toUpperCase()}`;
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(
      `${envName} is not set. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${envName} must decode to exactly 32 bytes of base64.`);
  }
  return key;
}

function deriveProjectKek(projectId: string, kekId: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      masterKey(kekId),
      Buffer.from(projectId, "utf8"),
      Buffer.from(`vaultlier/kek/${kekId}`, "utf8"),
      32,
    ),
  );
}

export function encryptSecret(projectId: string, plaintext: string): SealedValue {
  const kekId = CURRENT_KEK_ID;
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveProjectKek(projectId, kekId),
    nonce,
  );
  cipher.setAAD(Buffer.from(projectId, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return { ciphertext, nonce, authTag: cipher.getAuthTag(), kekId };
}

export function decryptSecret(projectId: string, sealed: SealedValue): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveProjectKek(projectId, sealed.kekId),
    sealed.nonce,
  );
  decipher.setAAD(Buffer.from(projectId, "utf8"));
  decipher.setAuthTag(sealed.authTag);
  return Buffer.concat([
    decipher.update(sealed.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
