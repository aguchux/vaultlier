import { describe, expect, it } from "vitest";
import { maskApiKey, parseArgs } from "./index.js";

describe("parseArgs", () => {
  it("parses command and --env flag", () => {
    const r = parseArgs(["pull", "--env=prod"]);
    expect(r.command).toBe("pull");
    expect(r.env).toBe("prod");
  });

  it("treats leading flags as flags, not the command", () => {
    const r = parseArgs(["--help"]);
    expect(r.command).toBeUndefined();
    expect(r.flags.help).toBe(true);
  });

  it("captures the command even when a flag comes first", () => {
    const r = parseArgs(["--help", "init"]);
    expect(r.command).toBe("init");
    expect(r.flags.help).toBe(true);
  });
});

describe("maskApiKey", () => {
  it("masks all but a prefix and suffix", () => {
    expect(maskApiKey("vlt_test_1234567890")).toBe("vlt_test…90");
  });

  it("fully masks short keys", () => {
    expect(maskApiKey("short")).toBe("****");
  });
});
