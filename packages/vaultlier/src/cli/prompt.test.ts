import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { selectFromList } from "./prompt.js";
import { createStyler } from "./ui.js";

const ESC = String.fromCharCode(27);
const style = createStyler(false);

function fakeTty() {
  const emitter = new EventEmitter() as EventEmitter & {
    isTTY: boolean;
    setRawMode: (raw: boolean) => void;
    resume: () => void;
    pause: () => void;
    rawMode: boolean;
  };
  emitter.isTTY = true;
  emitter.rawMode = false;
  emitter.setRawMode = (raw: boolean) => {
    emitter.rawMode = raw;
  };
  emitter.resume = () => {};
  emitter.pause = () => {};
  return emitter;
}

function output() {
  let text = "";
  return {
    write(chunk: string | Uint8Array): boolean {
      text += chunk.toString();
      return true;
    },
    read: () => text,
  };
}

const OPTIONS = [
  { label: "Create a new project" },
  { label: "checkout-api", hint: "prj_1" },
  { label: "billing", hint: "prj_2" },
];

async function pick(keys: string[], initialIndex?: number) {
  const stdin = fakeTty();
  const stdout = output();
  const selection = selectFromList({
    title: "Select a project",
    options: OPTIONS,
    stdin: stdin as never,
    stdout,
    style,
    initialIndex,
  });
  // Deliver keys on the next tick so the listener is attached.
  await Promise.resolve();
  for (const key of keys) stdin.emit("data", Buffer.from(key));
  return { index: await selection, stdin, stdout };
}

describe("selectFromList", () => {
  it("returns undefined on non-TTY stdin so callers can fall back", async () => {
    const stdout = output();
    const index = await selectFromList({
      title: "Select",
      options: OPTIONS,
      stdin: { isTTY: false } as never,
      stdout,
      style,
    });
    expect(index).toBeUndefined();
    expect(stdout.read()).toBe("");
  });

  it("selects the highlighted option with enter", async () => {
    const { index, stdout } = await pick(["\r"]);
    expect(index).toBe(0);
    expect(stdout.read()).toContain("Create a new project");
    expect(stdout.read()).toContain("checkout-api");
  });

  it("navigates with arrow keys and selects with space", async () => {
    const { index } = await pick([`${ESC}[B`, `${ESC}[B`, " "]);
    expect(index).toBe(2);
  });

  it("supports j/k navigation and wraps around", async () => {
    // From 0, k wraps to the last entry.
    expect((await pick(["k", "\r"])).index).toBe(2);
    expect((await pick(["j", "j", "j", "\r"])).index).toBe(0);
  });

  it("honors the initial index", async () => {
    const { index } = await pick(["\r"], 1);
    expect(index).toBe(1);
  });

  it("cancels on esc and ctrl+c, restoring raw mode", async () => {
    const escPick = await pick([ESC]);
    expect(escPick.index).toBeUndefined();
    expect(escPick.stdin.rawMode).toBe(false);

    const ctrlC = await pick([String.fromCharCode(3)]);
    expect(ctrlC.index).toBeUndefined();
    expect(ctrlC.stdin.rawMode).toBe(false);
  });

  it("renders hints alongside project options", async () => {
    const { stdout } = await pick(["\r"]);
    expect(stdout.read()).toContain("prj_1");
    expect(stdout.read()).toContain("prj_2");
  });
});
