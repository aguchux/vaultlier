/**
 * Terminal UI helpers for the CLI: ANSI colors, status symbols, and a
 * spinner. Chalk/ora distilled to the few features this CLI needs so the
 * package stays zero-dependency.
 *
 * Color activates only on a TTY and respects NO_COLOR / FORCE_COLOR. The
 * spinner animates only on an interactive stderr (and never in CI), so piped
 * output, logs, and tests see plain, stable text.
 */

type WriteStream = Pick<NodeJS.WritableStream, "write"> & { isTTY?: boolean };
type Env = Record<string, string | undefined>;

const ESC = String.fromCharCode(27);
const CLEAR_LINE = `\r${ESC}[2K`;
const FRAME_INTERVAL_MS = 80;

export interface Styler {
  green(text: string): string;
  red(text: string): string;
  yellow(text: string): string;
  cyan(text: string): string;
  dim(text: string): string;
  bold(text: string): string;
}

/** NO_COLOR wins, then FORCE_COLOR, then TTY detection. */
export function colorEnabled(stream: WriteStream, env: Env): boolean {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  const force = env.FORCE_COLOR;
  if (force !== undefined && force !== "" && force !== "0") return true;
  return stream.isTTY === true;
}

export function createStyler(enabled: boolean): Styler {
  const wrap =
    (open: number, close: number) =>
    (text: string): string =>
      enabled ? `${ESC}[${open}m${text}${ESC}[${close}m` : text;
  return {
    green: wrap(32, 39),
    red: wrap(31, 39),
    yellow: wrap(33, 39),
    cyan: wrap(36, 39),
    dim: wrap(2, 22),
    bold: wrap(1, 22),
  };
}

/** Legacy Windows consoles render braille/check glyphs as boxes. */
function useUnicode(env: Env): boolean {
  if (process.platform !== "win32") return true;
  return env.WT_SESSION !== undefined || env.TERM_PROGRAM !== undefined;
}

const UNICODE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ASCII_FRAMES = ["-", "\\", "|", "/"];

export interface Spinner {
  start(text: string): void;
  update(text: string): void;
  stop(): void;
}

/**
 * Animated activity indicator on `stream` (intended: stderr, keeping stdout
 * parseable). A no-op on non-TTY streams and in CI; stop() clears the line so
 * the spinner never leaves residue in front of real output.
 */
export function createSpinner(stream: WriteStream, env: Env): Spinner {
  const animate = stream.isTTY === true && env.CI === undefined;
  const frames = useUnicode(env) ? UNICODE_FRAMES : ASCII_FRAMES;
  const style = createStyler(colorEnabled(stream, env));
  let timer: NodeJS.Timeout | undefined;
  let index = 0;
  let text = "";

  const render = (): void => {
    const frame = frames[index % frames.length]!;
    index += 1;
    stream.write(`${CLEAR_LINE}${style.cyan(frame)} ${text}`);
  };

  return {
    start(nextText: string): void {
      text = nextText;
      if (!animate || timer) return;
      index = 0;
      render();
      timer = setInterval(render, FRAME_INTERVAL_MS);
      timer.unref?.();
    },
    update(nextText: string): void {
      text = nextText;
    },
    stop(): void {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
      stream.write(CLEAR_LINE);
    },
  };
}

export interface Ui {
  style: Styler;
  /** Completed step (green check). Written to stdout. */
  success(text: string): void;
  /** Degraded but continuing (yellow). Written to stdout. */
  warn(text: string): void;
  /** Secondary detail, dimmed on TTYs. Written to stdout. */
  info(text: string): void;
  /** Failure (red cross). Written to stderr. */
  error(text: string): void;
  /** Run `task` with a spinner; always clears it, even when the task throws. */
  spin<T>(text: string, task: () => Promise<T>): Promise<T>;
}

export function createUi(params: {
  stdout: WriteStream;
  stderr: WriteStream;
  env: Env;
}): Ui {
  const out = createStyler(colorEnabled(params.stdout, params.env));
  const err = createStyler(colorEnabled(params.stderr, params.env));
  const symbols = useUnicode(params.env)
    ? { ok: "✓", fail: "✗", warn: "⚠" }
    : { ok: "√", fail: "×", warn: "!" };
  const spinner = createSpinner(params.stderr, params.env);

  return {
    style: out,
    success(text: string): void {
      params.stdout.write(`${out.green(symbols.ok)} ${text}\n`);
    },
    warn(text: string): void {
      params.stdout.write(`${out.yellow(`${symbols.warn} ${text}`)}\n`);
    },
    info(text: string): void {
      params.stdout.write(`${out.dim(text)}\n`);
    },
    error(text: string): void {
      params.stderr.write(`${err.red(`${symbols.fail} ${text}`)}\n`);
    },
    async spin<T>(text: string, task: () => Promise<T>): Promise<T> {
      spinner.start(text);
      try {
        return await task();
      } finally {
        spinner.stop();
      }
    },
  };
}
