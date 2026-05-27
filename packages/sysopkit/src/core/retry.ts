import { context, utility } from './context.js';
import { isAbortError } from './errors.js';
import { sleep } from './sleep.js';

/** Configuration for retry behavior. */
export interface RetryOptions {
  readonly attempts: number;
  readonly delay?: number;
  readonly backoff?: 'fixed' | 'exponential';
  readonly maxDelay?: number;
  readonly retryOn?: (err: any) => boolean;
}

/**
 * Calls `fn` once, then retries up to `attempts` additional times on failure.
 *
 * Skips retry on AbortError (cancellation should propagate immediately).
 * If `retryOn` is provided, only errors matching the predicate are retried.
 */
export async function retry<T>(options: RetryOptions, fn: () => Promise<T>): Promise<T> {
  return utility('retry', async () => {
    const ctx = context();
    const attempts = options.attempts;
    let attempt = 1;

    while (true) {
      ctx.signal.throwIfAborted();
      try {
        return await fn();
      } catch (err) {
        if (
          !isAbortError(err) &&
          attempt <= attempts &&
          (options.retryOn === void 0 || options.retryOn(err))
        ) {
          const delay = calculateDelay(attempt, options);
          ctx.reporter.retryAttempt(ctx, attempt, delay, err);
          await sleep(delay);
          attempt++;
        } else {
          throw err;
        }
      }
    }
  });
}

/**
 * Calculates the delay before the next retry attempt.
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param opts - Retry options containing delay and backoff settings
 * @returns Delay in milliseconds before next attempt
 */
function calculateDelay(attempt: number, opts: RetryOptions): number {
  const baseDelay = opts.delay ?? 1000;
  if (opts.backoff === 'exponential') {
    const delay = baseDelay * Math.pow(2, attempt);
    return opts.maxDelay !== void 0 ? Math.min(delay, opts.maxDelay) : delay;
  }
  return baseDelay;
}
