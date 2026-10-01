import type { Connector } from './connector.js';
import { task } from './context.js';
import { sleep } from './sleep.js';
import { TimeoutError } from './timeout.js';

/** Options for {@link waitForReady}. */
export interface WaitForReadyOptions {
  /** Budget in milliseconds before throwing `TimeoutError` (default: 5*60_000). */
  readonly timeoutMs?: number;
  /** Delay in milliseconds between `isReady()` polls (default: 5_000). */
  readonly intervalMs?: number;
  /** AbortSignal for cancellation. */
  readonly signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_INTERVAL_MS = 5_000;

/**
 * Poll a live connector's side-effect-free `isReady()` until it returns true.
 *
 * Takes a live instance (not a factory) since `isReady` must be
 * side-effect-free. Wraps the loop in `task()` internally, so `sleep()`
 * stays abort-aware via the task context.
 *
 * Throws `TimeoutError` carrying the host and budget when the budget burns,
 * and propagates aborts unchanged.
 *
 * @param conn - Live connector to poll (e.g. `new SSHConnector({...})`)
 * @param opts - Timeout/interval/signal options
 *
 * @example
 * ```typescript
 * await waitForReady(new SSHConnector({ host: '10.0.1.1' }));
 * ```
 */
export async function waitForReady(conn: Connector, opts?: WaitForReadyOptions): Promise<void> {
  // Resolved without throwing so the task name is always available;
  // invalid inputs are refused inside the task body (a throw outside
  // task() would miss the task frame in the reported context stack).
  const host = (conn as Connector | undefined)?.host ?? 'unknown';
  const name = `wait for '${host}' to become ready`;
  return task(
    name,
    async (ctx) => {
      if (conn === void 0 || conn === null || typeof conn.isReady !== 'function') {
        throw new Error('refusing: conn with isReady() is required');
      }
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`refusing: bad timeoutMs '${String(opts?.timeoutMs)}'`);
      }
      if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        throw new Error(`refusing: bad intervalMs '${String(opts?.intervalMs)}'`);
      }
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        ctx.signal.throwIfAborted();
        if (await conn.isReady(ctx.signal)) {
          return;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          break;
        }
        await sleep(Math.min(intervalMs, remaining));
      }
      throw new TimeoutError(
        `Timed out waiting for '${conn.host}' to become ready after ${timeoutMs}ms`,
      );
    },
    { signal: opts?.signal },
  );
}
