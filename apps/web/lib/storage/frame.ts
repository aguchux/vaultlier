/**
 * Binary framing for a SealedBlob stored as a single opaque payload (used by
 * object-store adapters like S3). Layout, all big-endian:
 *
 *   [u8  kekIdLen][kekId bytes]
 *   [u8  nonceLen][nonce bytes]
 *   [u8  authTagLen][authTag bytes]
 *   [ciphertext ... to end]
 *
 * Nonce (12) and GCM tag (16) are tiny and kekId is a short label, so single
 * length bytes are sufficient. The payload contains only ciphertext + AEAD
 * material — never plaintext.
 */

import type { SealedBlob } from "./types";

export function frameBlob(blob: SealedBlob): Buffer {
  const kekId = Buffer.from(blob.kekId, "utf8");
  const nonce = Buffer.from(blob.nonce);
  const authTag = Buffer.from(blob.authTag);
  const ciphertext = Buffer.from(blob.ciphertext);
  if (kekId.length > 255 || nonce.length > 255 || authTag.length > 255) {
    throw new Error("storage frame: header field too long");
  }
  return Buffer.concat([
    Buffer.from([kekId.length]),
    kekId,
    Buffer.from([nonce.length]),
    nonce,
    Buffer.from([authTag.length]),
    authTag,
    ciphertext,
  ]);
}

export function unframeBlob(payload: Uint8Array): SealedBlob {
  const buf = Buffer.from(payload);
  let offset = 0;
  const read = (): Buffer => {
    if (offset >= buf.length) throw new Error("storage frame: truncated");
    const len = buf[offset] ?? 0;
    offset += 1;
    if (offset + len > buf.length) throw new Error("storage frame: truncated");
    const slice = buf.subarray(offset, offset + len);
    offset += len;
    return slice;
  };
  const kekId = read().toString("utf8");
  const nonce = read();
  const authTag = read();
  const ciphertext = buf.subarray(offset);
  return {
    kekId,
    nonce: new Uint8Array(nonce),
    authTag: new Uint8Array(authTag),
    ciphertext: new Uint8Array(ciphertext),
  };
}
