import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  colorEnabled,
  createSpinner,
  createStyler,
  createUi,
} from "./ui.js";

const ESC = String.fromCharCode(27);

function fakeStream(isTTY?: boolean) {
  let text = "";
  return {
    isTTY,
    write(chunk: string | Uint8Array): boolean {
      text += chunk.toString();
      return true;
    },
    read(): string {
      return text;
    },
  };
}

describe("colorEnabled", () => {
  it("follows TTY detection by default", () => {
    expect(colorEnabled(fakeStream(true), {})).toBe(true);
    expect(colorEnabled(fakeStream(false), {})).toBe(false);
    expect(colorEnabled(fakeStream(undefined), {})).toBe(false);
  });

  it("NO_COLOR disables color even on a TTY", () => {
    expect(colorEnabled(fakeStream(true), { NO_COLOR: "1" })).toBe(false);
  });

  it("FORCE_COLOR enables color without a TTY, but loses to NO_COLOR", () => {
    expect(colorEnabled(fakeStream(false), { FORCE_COLOR: "1" })).toBe(true);
    expect(colorEnabled(fakeStream(false), { FORCE_COLOR: "0" })).toBe(false);
    expect(
      colorEnabled(fakeStream(true), { NO_COLOR: "1", FORCE_COLOR: "1" }),
    ).toBe(false);
  });
});

describe("createStyler", () => {
  it("wraps text in ANSI codes when enabled", () => {
    const style = createStyler(true);
    expect(style.green("ok")).toBe(`${ESC}[32mok${ESC}[39m`);
    expect(style.dim("hint")).toBe(`${ESC}[2mhint${ESC}[22m`);
  });

  it("returns text unchanged when disabled", () => {
    const style = createStyler(false);
    expect(style.red("plain")).toBe("plain");
    expect(style.bold("plain")).toBe("plain");
  });
});

describe("createSpinner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is silent on non-TTY streams", () => {
    const stream = fakeStream(false);
    const spinner = createSpinner(stream, {});
    spinner.start("working");
    vi.advanceTimersByTime(500);
    spinner.stop();
    expect(stream.read()).toBe("");
  });

  it("is silent in CI even on a TTY", () => {
    const stream = fakeStream(true);
    const spinner = createSpinner(stream, { CI: "true" });
    spinner.start("working");
    spinner.stop();
    expect(stream.read()).toBe("");
  });

  it("animates on a TTY and clears the line on stop", () => {
    const stream = fakeStream(true);
    const spinner = createSpinner(stream, {});
    spinner.start("fetching");
    vi.advanceTimersByTime(250);
    spinner.update("still fetching");
    vi.advanceTimersByTime(100);
    spinner.stop();

    const out = stream.read();
    expect(out).toContain("fetching");
    expect(out).toContain("still fetching");
    // Every frame rewrites the same line; stop leaves it cleared.
    expect(out).toContain(`\r${ESC}[2K`);
    expect(out.endsWith(`\r${ESC}[2K`)).toBe(true);
  });
});

describe("createUi", () => {
  it("writes plain symbol-prefixed lines when streams are not TTYs", () => {
    const stdout = fakeStream(false);
    const stderr = fakeStream(false);
    const ui = createUi({ stdout, stderr, env: {} });

    ui.success("done");
    ui.warn("careful");
    ui.info("detail");
    ui.error("broken");

    expect(stdout.read()).toContain("done");
    expect(stdout.read()).toContain("careful");
    expect(stdout.read()).toContain("detail");
    expect(stdout.read()).not.toContain(ESC);
    expect(stderr.read()).toContain("broken");
    expect(stderr.read()).not.toContain(ESC);
  });

  it("routes errors to stderr and everything else to stdout", () => {
    const stdout = fakeStream(false);
    const stderr = fakeStream(false);
    const ui = createUi({ stdout, stderr, env: {} });

    ui.error("oops");
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain("oops");
  });

  it("spin resolves the task value and clears the spinner on throw", async () => {
    const stdout = fakeStream(false);
    const stderr = fakeStream(true);
    const ui = createUi({ stdout, stderr, env: { CI: "true" } });

    expect(await ui.spin("task", async () => 42)).toBe(42);
    await expect(
      ui.spin("task", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("colors output when FORCE_COLOR is set", () => {
    const stdout = fakeStream(false);
    const ui = createUi({
      stdout,
      stderr: fakeStream(false),
      env: { FORCE_COLOR: "1" },
    });
    ui.success("done");
    expect(stdout.read()).toContain(`${ESC}[32m`);
  });
});
