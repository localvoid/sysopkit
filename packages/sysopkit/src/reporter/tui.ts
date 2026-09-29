/**
 * @module reporter/tui
 *
 * Helpers for the ConsoleReporter live footer (TUI mode).
 *
 * The footer shows one line per concurrent top-level branch at the bottom of
 * an interactive terminal. Deeper tasks reuse their branch slot so each host
 * stays at a stable position while its stack grows.
 */

/** TUI enable mode for ConsoleReporter. */
export type TuiMode = boolean | 'auto';

/** Minimal context shape needed for slot assignment. */
export interface SlotContext {
  readonly type: string;
  readonly parent: SlotContext | null;
}

/** Spinner frames cycled on each TUI tick. */
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

// eslint-disable-next-line no-control-regex -- matching ANSI escape sequences requires ESC
const ANSI_PATTERN = /\x1b\[[0-9;?]*[A-Za-z]/g;

/**
 * Resolves whether TUI footer mode is enabled.
 *
 * - `false` always disables, `true` always enables (forced, even without TTY).
 * - `'auto'` (default) enables only when `isTTY` is true, unless the standard
 *   `TERM=dumb` variable indicates a non-capable terminal.
 */
export function resolveTuiEnabled(
  mode: TuiMode | undefined,
  env: Record<string, string | undefined> = process.env,
  isTTY: boolean | undefined = process.stderr?.isTTY,
): boolean {
  if (mode === false) {
    return false;
  }
  if (mode === true) {
    return true;
  }

  if (env['TERM'] === 'dumb') {
    return false;
  }

  return isTTY === true;
}

/**
 * Finds the stable footer slot for a context.
 *
 * Returns the outermost (closest to root) `connector` ancestor when one exists,
 * otherwise the outermost `task` ancestor. All deeper tasks under the same
 * branch therefore map to the same slot and stay at the same position.
 */
export function findSlotKey<T extends SlotContext>(ctx: T): T {
  let topConnector: SlotContext | null = null;
  let topTask: SlotContext | null = null;
  let node: SlotContext | null = ctx;
  while (node !== null) {
    if (node.type === 'connector') {
      topConnector = node;
    } else if (node.type === 'task') {
      topTask = node;
    }
    node = node.parent;
  }
  if (topConnector !== null) {
    return topConnector as T;
  }
  if (topTask !== null) {
    return topTask as T;
  }
  return ctx;
}

/** Strips ANSI escape sequences for visible-length measurement. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/**
 * Truncates a (possibly ANSI-colored) line to a terminal width.
 *
 * Lines that fit are returned unchanged (colors preserved). Overlong lines fall
 * back to a stripped, truncated form to avoid breaking escape sequences and to
 * guarantee one terminal row per slot.
 */
export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) {
    return '';
  }
  if (stripAnsi(text).length <= width) {
    return text;
  }
  if (width === 1) {
    return '…';
  }
  return `${stripAnsi(text).slice(0, width - 1)}…`;
}
