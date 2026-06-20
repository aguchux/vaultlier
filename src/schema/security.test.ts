import { describe, expect, it } from "vitest";
import {
  REDACTED,
  looksLikeApiKey,
  maskSecret,
  redact,
  safeEqual,
} from "./security.js";

describe("maskSecret", () => {
  it("keeps a prefix and the last two chars", () => {
    expect(maskSecret("vlt_live_1234567890")).toBe("vlt_live…90");
  });

  it("fully masks short values", () => {
    expect(maskSecret("short")).toBe("****");
  });

  it("returns the redaction marker for empty input", () => {
    expect(maskSecret("")).toBe(REDACTED);
  });
});

describe("redact", () => {
  it("redacts values of sensitive keys", () => {
    const out = redact({
      apiKey: "vlt_live_abc",
      DATABASE_PASSWORD: "hunter2",
      authorization: "Bearer xyz",
      keep: "visible",
    });
    expect(out).toEqual({
      apiKey: REDACTED,
      DATABASE_PASSWORD: REDACTED,
      authorization: REDACTED,
      keep: "visible",
    });
  });

  it("recurses into nested objects and arrays", () => {
    const out = redact({ list: [{ token: "t", id: 1 }] });
    expect(out).toEqual({ list: [{ token: REDACTED, id: 1 }] });
  });

  it("handles cycles without throwing", () => {
    const obj: Record<string, unknown> = { name: "x" };
    obj.self = obj;
    expect(() => redact(obj)).not.toThrow();
  });
});

describe("safeEqual", () => {
  it("is true only for identical strings", () => {
    expect(safeEqual("vlt_abc", "vlt_abc")).toBe(true);
    expect(safeEqual("vlt_abc", "vlt_abd")).toBe(false);
  });

  it("is false for length mismatch", () => {
    expect(safeEqual("a", "ab")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(safeEqual("a", undefined as unknown as string)).toBe(false);
  });
});

describe("looksLikeApiKey", () => {
  it("accepts well-formed vlt_ keys", () => {
    expect(looksLikeApiKey("vlt_test_12345678")).toBe(true);
  });

  it("rejects malformed or non-string input", () => {
    expect(looksLikeApiKey("nope")).toBe(false);
    expect(looksLikeApiKey("vlt_short")).toBe(false); // suffix < 8 chars
    expect(looksLikeApiKey("")).toBe(false);
    expect(looksLikeApiKey(42)).toBe(false);
  });
});
