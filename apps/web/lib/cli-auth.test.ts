import { describe, expect, it } from "vitest";
import {
  CLI_POLL_INTERVAL_SECONDS,
  CLI_SESSION_TTL_SECONDS,
  cliTokenExpiry,
  generateCliToken,
  generateSessionPublicId,
  generateUserCode,
  hashCliToken,
} from "./cli-auth";

describe("generateCliToken", () => {
  it("produces a vlt_acct_ token whose prefix is a non-sensitive slice", () => {
    const { rawToken, prefix } = generateCliToken();
    expect(rawToken).toMatch(/^vlt_acct_[0-9a-f]{48}$/);
    // The prefix is the leading 13 chars — the family marker, nothing secret.
    expect(prefix).toBe(rawToken.slice(0, 13));
    expect(rawToken.startsWith(prefix)).toBe(true);
  });

  it("generates distinct tokens", () => {
    expect(generateCliToken().rawToken).not.toBe(generateCliToken().rawToken);
  });
});

describe("hashCliToken", () => {
  it("is deterministic and hides the raw token", () => {
    const raw = "vlt_acct_deadbeef";
    const hash = hashCliToken(raw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashCliToken(raw));
    expect(hash).not.toContain(raw);
  });

  it("differs for different inputs", () => {
    expect(hashCliToken("a")).not.toBe(hashCliToken("b"));
  });
});

describe("generateUserCode", () => {
  it("formats as XXXX-XXXX from an unambiguous alphabet", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateUserCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      // No ambiguous characters that confuse spoken/typed codes.
      expect(code).not.toMatch(/[O01I]/);
    }
  });
});

describe("generateSessionPublicId", () => {
  it("is a prefixed opaque id, distinct per call", () => {
    const a = generateSessionPublicId();
    expect(a).toMatch(/^cls_[0-9a-f]{32}$/);
    expect(a).not.toBe(generateSessionPublicId());
  });
});

describe("cliTokenExpiry", () => {
  it("is 90 days after the reference time", () => {
    const now = new Date("2026-06-13T00:00:00.000Z");
    const expiry = cliTokenExpiry(now);
    const days = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(90);
  });
});

describe("session timing constants", () => {
  it("uses a 15-minute TTL and a 5-second poll interval", () => {
    expect(CLI_SESSION_TTL_SECONDS).toBe(900);
    expect(CLI_POLL_INTERVAL_SECONDS).toBe(5);
  });
});
