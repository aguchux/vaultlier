/**
 * Interactive terminal prompts, dependency-free.
 *
 * `selectFromList` renders a vertical menu navigated with arrow keys (or
 * j/k) and confirmed with Enter or Space; Esc or Ctrl+C cancels. It needs a
 * raw-mode TTY — on anything else it returns undefined so callers can fall
 * back to flags or plain text prompts (CI stays non-interactive).
 */

import type { Styler } from "./ui.js";

type SelectStdin = NodeJS.ReadableStream & {
  isTTY?: boolean;
  setRawMode?: (raw: boolean) => void;
};

export interface SelectParams {
  title: string;
  options: Array<{ label: string; hint?: string }>;
  stdin: SelectStdin;
  stdout: Pick<NodeJS.WritableStream, "write">;
  style: Styler;
  /** Initially highlighted index. Defaults to 0. */
  initialIndex?: number;
}

const ESC = String.fromCharCode(27);
const KEY_UP = `${ESC}[A`;
const KEY_DOWN = `${ESC}[B`;
const CTRL_C = String.fromCharCode(3);

/**
 * Resolves with the chosen option index, or undefined when cancelled or when
 * the terminal cannot run an interactive menu.
 */
export function selectFromList(
  params: SelectParams,
): Promise<number | undefined> {
  const { stdin, stdout, style } = params;
  if (params.options.length === 0) return Promise.resolve(undefined);
  if (stdin.isTTY !== true || typeof stdin.setRawMode !== "function") {
    return Promise.resolve(undefined);
  }

  let index = Math.min(
    Math.max(params.initialIndex ?? 0, 0),
    params.options.length - 1,
  );
  let rendered = false;

  const renderLines = (): string => {
    const lines = params.options.map((option, i) => {
      const pointer = i === index ? style.cyan(">") : " ";
      const label = i === index ? style.bold(option.label) : option.label;
      const hint = option.hint ? ` ${style.dim(option.hint)}` : "";
      return `${ESC}[2K${pointer} ${label}${hint}`;
    });
    // After the first paint, move the cursor back up over the menu block.
    const reset = rendered ? `${ESC}[${params.options.length}A\r` : "";
    rendered = true;
    return `${reset}${lines.join("\n")}\n`;
  };

  stdout.write(
    `${params.title} ${style.dim("(arrows or j/k to move, enter to select, esc to cancel)")}\n`,
  );
  stdout.write(renderLines());

  return new Promise((resolve) => {
    const finish = (result: number | undefined): void => {
      stdin.off?.("data", onData);
      stdin.setRawMode?.(false);
      stdin.pause?.();
      resolve(result);
    };

    const onData = (chunk: Buffer | string): void => {
      const input = chunk.toString("utf8");
      if (input === CTRL_C || input === ESC) {
        finish(undefined);
        return;
      }
      if (input === "\r" || input === "\n" || input === " ") {
        finish(index);
        return;
      }
      if (input === KEY_UP || input === "k") {
        index = (index - 1 + params.options.length) % params.options.length;
        stdout.write(renderLines());
        return;
      }
      if (input === KEY_DOWN || input === "j") {
        index = (index + 1) % params.options.length;
        stdout.write(renderLines());
      }
    };

    stdin.setRawMode?.(true);
    stdin.resume?.();
    stdin.on("data", onData);
  });
}
