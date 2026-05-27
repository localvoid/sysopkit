import { ONCE } from '../utils/constants.js';
import { context } from './context.js';

/**
 * Abort-aware delay that rejects with `signal.reason` on cancellation.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ctx = context();
    const signal = ctx.signal;
    signal.throwIfAborted();

    const clear = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', clear);
      resolve();
    }, ms);

    signal.addEventListener('abort', clear, ONCE);
  });
}
