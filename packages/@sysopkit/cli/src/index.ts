/**
 * Interactive terminal input helpers.
 *
 * @module cli
 */

import {
  CURSOR_HIDE,
  CURSOR_SHOW,
  CURSOR_START,
  cursorMoveDown,
  cursorMoveUp,
  ERASE_LINE,
  ERASE_SCREEN,
} from './term.js';

/** Thrown when user interrupts an interactive prompt (Ctrl+C). */
export class InterruptError extends Error {}

/**
 * Prompt the user for a password with optional echo masking.
 *
 * Reads raw stdin until Enter is pressed. Supports Ctrl+C (interrupt),
 * Ctrl+U (clear line), Ctrl+W (delete word), and Backspace.
 *
 * When `silent` is false, typed characters are echoed as `*`.
 * When `silent` is true, no visual feedback is given.
 */
export async function password(query: string, silent = false): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(query);

  stdin.setRawMode(true);
  stdin.resume();

  const decoder = new TextDecoder();
  let password = '';

  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const input = decoder.decode(chunk, STREAM_TRUE);
      for (const char of input) {
        if (char === '\r' || char === '\n') {
          process.stdout.write(CURSOR_START);
          process.stdout.write(ERASE_LINE);
          cleanup();
          resolve(password);
        } else if (char === '\x03') {
          stdout.write('\n');
          throw new InterruptError(); // exit code = 130 (128 + SIGINT)
        } else if (char === '\x15') {
          stdout.write('\x08 \x08'.repeat(password.length));
          password = '';
        } else if (char === '\x17') {
          const trimmed = password.trimEnd();
          const lastSpace = trimmed.lastIndexOf(' ');
          const newPassword = lastSpace === -1 ? '' : trimmed.slice(0, lastSpace + 1);
          if (!silent) {
            stdout.write('\x08 \x08'.repeat(password.length - newPassword.length));
          }
          password = newPassword;
          continue;
        } else if (char === '\x7f' || char === '\x08') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            if (!silent) {
              stdout.write('\x08 \x08');
            }
          }
        } else if (char >= ' ') {
          password += char;
          if (!silent) {
            stdout.write('*');
          }
        }
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}

/**
 * Render an interactive selection menu with keyboard navigation.
 *
 * Displays `query` followed by option keys from `options`. User navigates
 * with Up/Down arrows and confirms with Enter. Throws `InterruptError` on
 * Ctrl+C.
 */
export async function select<T>(query: string, options: Record<string, T>): Promise<T> {
  const { stdin, stdout } = process;
  const entries = Object.entries(options);
  let index = 0;

  const render = () => {
    stdout.write(`${CURSOR_START}${ERASE_LINE}${query}\n`);
    for (let i = 0; i < entries.length; i++) {
      const isSelected = i === index;
      const prefix = isSelected ? ' ● ' : ' ○ ';
      const color = isSelected ? '\x1B[32m' : '\x1B[90m';
      stdout.write(`${ERASE_LINE}${prefix}${color}${entries[i][0]}\x1B[0m\n`);
    }
    stdout.write(cursorMoveUp(entries.length + 1));
  };
  stdout.write(CURSOR_HIDE);
  stdin.setRawMode(true);
  stdin.resume();
  render();

  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const char = chunk.toString();

      if (char === '\r' || char === '\n') {
        process.stdout.write(CURSOR_START);
        process.stdout.write(ERASE_SCREEN);
        cleanup();
        resolve(entries[index][1]);
      } else if (char === '\x03') {
        stdout.write(cursorMoveDown(entries.length + 1));
        cleanup();
        throw new InterruptError();
      } else if (char === '\x1B[A') {
        index = (index - 1 + entries.length) % entries.length;
        render();
      } else if (char === '\x1B[B') {
        index = (index + 1) % entries.length;
        render();
      }
    };

    const cleanup = () => {
      stdout.write(CURSOR_SHOW);
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}

/**
 * Prompt for a yes/no confirmation.
 *
 * Convenience wrapper around `select` with Yes/No options.
 */
export function confirm(query: string): Promise<boolean> {
  return select(query, YES_NO);
}

const YES_NO = { Yes: true, No: false };
const STREAM_TRUE = { stream: true };
