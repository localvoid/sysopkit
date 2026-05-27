import { utility } from './context.js';

/**
 * Runs `fn` and throws `TimeoutError` if it exceeds `ms` milliseconds.
 *
 * @param ms - Timeout in milliseconds
 * @param fn - Function to execute with timeout
 * @returns Result of the function call
 */
export async function timeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  let t: NodeJS.Timeout | undefined = setTimeout(() => {
    t = void 0;
    ctrl.abort(new TimeoutError());
  }, ms);
  try {
    return await utility('timeout', fn, { signal: ctrl.signal });
  } finally {
    if (t !== void 0) {
      clearTimeout(t);
    }
  }
}

export class TimeoutError extends Error {
  constructor(message = 'timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}
