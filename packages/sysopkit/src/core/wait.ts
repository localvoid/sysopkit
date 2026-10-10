import type { Connector } from './connector.js';
import { ExecError } from '../utils/process.js';
import { task } from './context.js';
import { ConnectorError, isAbortError } from './errors.js';
import { VERBOSITY_TRACE } from './reporter.js';
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

/** Budget for {@link waitUntil} when no `timeoutMs` is given (default: 10 min). */
const DEFAULT_UNTIL_TIMEOUT_MS = 10 * 60_000;
/** Poll interval for {@link waitUntil} when no `intervalMs` is given (default: 1_000). */
const DEFAULT_UNTIL_INTERVAL_MS = 1_000;

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
    { signal: opts?.signal, verbosity: VERBOSITY_TRACE },
  );
}

/** Options for {@link waitUntil}. */
export interface WaitUntilOptions {
  /** Delay in milliseconds between `check()` polls (default: 1_000). */
  readonly intervalMs?: number;
  /** Total budget in milliseconds before throwing `TimeoutError` (default: 10*60_000). */
  readonly timeoutMs?: number;
  /** Probe throws counting as "not yet" (default: `ConnectorError` + `ExecError`). */
  readonly retryOn?: (err: any) => boolean;
  /** Human label for the task name + timeout errors. */
  readonly describe?: string;
  /** AbortSignal for cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * Probe throws matching `retryOn` count as "not yet" (default: connection errors).
 *
 * Within a wait loop any remote failure is observationally "not yet":
 * connection refused/timeout surfaces as `ConnectorError` (connect) or
 * `ExecError`/`ShellError` (spawned probe exiting non-zero, e.g. ssh exit 255
 * while the target is down). Genuine breakage still fails closed at
 * `timeoutMs` with a labeled `TimeoutError`.
 */
export function isWaitRetryable(err: unknown): boolean {
  return err instanceof ConnectorError || err instanceof ExecError;
}

/**
 * Poll `check()` until it returns true.
 *
 * `false`, missing resources, and `retryOn`-matching throws are all "not yet";
 * anything else propagates immediately. Always fail-closed at `timeoutMs`.
 * Abort-aware each iteration, consistent with the other wait ops.
 *
 * @param check - Predicate returning true when the waited state is reached
 * @param opts - Interval/timeout/retryOn/describe/signal options
 *
 * @example
 * ```typescript
 * await waitUntil(async () => (await tryReadFile('/proc/cmdline') ?? '').includes('break=mount'), {
 *   timeoutMs: 20 * 60_000,
 *   describe: 'rescue cmdline',
 * });
 * ```
 */
export async function waitUntil(
  check: () => Promise<boolean>,
  opts?: WaitUntilOptions,
): Promise<void> {
  // Resolved without throwing so the task name is always available;
  // invalid inputs are refused inside the task body (a throw outside
  // task() would miss the task frame in the reported context stack).
  const describe = opts?.describe ?? 'condition';
  const name = `wait ${describe}`;
  return task(
    name,
    async (ctx) => {
      if (typeof check !== 'function') {
        throw new Error('refusing: check() predicate is required');
      }
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_UNTIL_TIMEOUT_MS;
      const intervalMs = opts?.intervalMs ?? DEFAULT_UNTIL_INTERVAL_MS;
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`refusing: bad timeoutMs '${String(opts?.timeoutMs)}'`);
      }
      if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        throw new Error(`refusing: bad intervalMs '${String(opts?.intervalMs)}'`);
      }
      const retryOn = opts?.retryOn ?? isWaitRetryable;
      if (typeof retryOn !== 'function') {
        throw new Error('refusing: retryOn must be a function');
      }
      const deadline = Date.now() + timeoutMs;
      let lastError: unknown;
      for (;;) {
        ctx.signal.throwIfAborted();
        try {
          if (await check()) {
            return;
          }
        } catch (err) {
          if (isAbortError(err)) {
            throw err;
          }
          ctx.signal.throwIfAborted();
          if (!retryOn(err)) {
            throw err;
          }
          lastError = err;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          break;
        }
        await sleep(Math.min(intervalMs, remaining));
      }
      throw new TimeoutError(
        `timed out waiting for ${describe} after ${timeoutMs}ms`,
        lastError === void 0 ? void 0 : { cause: lastError },
      );
    },
    { signal: opts?.signal, verbosity: VERBOSITY_TRACE },
  );
}
