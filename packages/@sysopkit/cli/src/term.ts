/**
 * Terminal cursor control and screen manipulation via ANSI escape sequences.
 *
 * @module term
 */

/**
 * Move cursor to absolute position.
 *
 * When `y` is 0, moves only horizontally to column `x + 1` on the current line.
 */
export function cursorMoveTo(x: number, y: number): string {
  if (!y) return `\x1B[${x + 1}G`;
  return `\x1B[${y + 1};${x + 1}H`;
}

/** Move cursor up by `i` lines. */
export const cursorMoveUp = (i: number): string => `\x1B[${i}A`;
/** Move cursor down by `i` lines. */
export const cursorMoveDown = (i: number): string => `\x1B[${i}B`;
/** Move cursor forward by `i` columns. */
export const cursorMoveForward = (i: number): string => `\x1B[${i}C`;
/** Move cursor backward by `i` columns. */
export const cursorMoveBackward = (i: number): string => `\x1B[${i}D`;

/**
 * Move cursor by relative offset.
 *
 * Negative values move left/up, positive values move right/down.
 */
export function cursorMove(x: number, y: number): string {
  let ret = '';

  if (x < 0) ret += `\x1B[${-x}D`;
  else if (x > 0) ret += `\x1B[${x}C`;

  if (y < 0) ret += `\x1B[${-y}A`;
  else if (y > 0) ret += `\x1B[${y}B`;

  return ret;
}

/** Carriage return – move cursor to start of current line. */
export const CURSOR_START = '\r';
/** Move cursor up one line. */
export const CURSOR_UP = '\x1B[1A';
/** Move cursor down one line. */
export const CURSOR_DOWN = '\x1B[1B';
/** Move cursor to beginning of previous line. */
export const CURSOR_PREV_LINE = '\x1B[E';
/** Move cursor to beginning of next line. */
export const CURSOR_NEXT_LINE = '\x1B[F';
/** Move cursor to column 0 of current line. */
export const CURSOR_LEFT = '\x1B[G';
/** Hide the cursor. */
export const CURSOR_HIDE = '\x1B[?25l';
/** Show the cursor. */
export const CURSOR_SHOW = '\x1B[?25h';
/** Save cursor position and attributes. */
export const CURSOR_SAVE = '\x1B7';
/** Restore cursor position and attributes. */
export const CURSOR_RESTORE = '\x1B8';

/** Scroll terminal buffer up by one line. */
export const SCROLL_UP = '\x1B[S';
/** Scroll terminal buffer down by one line. */
export const SCROLL_DOWN = '\x1B[T';

/** Erase entire screen. */
export const ERASE_SCREEN = '\x1B[2J';
/** Erase from cursor to beginning of screen. */
export const ERASE_UP = '\x1B[1J';
/** Erase from cursor to end of screen. */
export const ERASE_DOWN = '\x1B[J';
/** Erase entire current line. */
export const ERASE_LINE = '\x1B[2K';
/** Erase from cursor to end of line. */
export const ERASE_LINE_END = '\x1B[K';
/** Erase from cursor to start of line. */
export const ERASE_LINE_START = '\x1B[1K';

/**
 * Erase `count` lines above and including the current line, then return cursor to line start.
 */
export function eraseLines(count: number): string {
  let clear = '';
  for (let i = 0; i < count; i++) {
    clear += ERASE_LINE + (i < count - 1 ? CURSOR_UP : '');
  }
  if (count) clear += CURSOR_LEFT;
  return clear;
}

/** Reset terminal (full reset escape sequence). */
export const CLEAR_SCREEN = `\x1Bc`;
