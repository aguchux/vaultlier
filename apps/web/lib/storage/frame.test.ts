import { describe, expect, it } from "vitest";
import { frameBlob, unframeBlob } from "./frame";
import type { SealedBlob } from "./types";

function blob(overrides: Partial<SealedBlob> = {}): SealedBlob {
  return {
    kekId: "mk1",
    nonce: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    authTag: new Uint8Array(16).fill(7),
    ciphertext: new Uint8Array([0, 255, 128, 64, 32]),
    ...overrides,
  };
}

describe("storage frame", () => {
  it("round-trips a sealed blob byte-for-byte", () => {
    const original = blob();
    const round = unframeBlob(frameBlob(original));
    expect(round.kekId).toBe(original.kekId);
    expect(Array.from(round.nonce)).toEqual(Array.from(original.nonce));
    expect(Array.from(round.authTag)).toEqual(Array.from(original.authTag));
    expect(Array.from(round.ciphertext)).toEqual(Array.from(original.ciphertext));
  });

  it("handles an empty ciphertext", () => {
    const round = unframeBlob(frameBlob(blob({ ciphertext: new Uint8Array(0) })));
    expect(round.ciphertext.length).toBe(0);
  });

  it("rejects a truncated payload", () => {
    const framed = frameBlob(blob());
    expect(() => unframeBlob(framed.subarray(0, 2))).toThrow(/truncated/);
  });

  it("rejects an over-long header field", () => {
    expect(() => frameBlob(blob({ kekId: "x".repeat(256) }))).toThrow(/too long/);
  });
});
