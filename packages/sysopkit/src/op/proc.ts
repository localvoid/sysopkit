/**
 * @module op/proc
 *
 * Process state waiting utilities.
 */

import { task } from '../core/context.js';
import { VERBOSITY_TRACE } from '../core/reporter.js';
import { sleep } from '../core/sleep.js';
import { sh } from './sh.js';

/**
 * Configuration for waitProcess operation.
 */
export interface WaitProcessOptions {
  /** Process name to look for. */
  readonly process: string;
  /** Delay between checks in milliseconds. Defaults to 1000 (1 second). */
  readonly delay?: number;
  /** Desired process state. Defaults to "active". */
  readonly state?: 'active' | 'terminated';
}

/**
 * Waits for a process to be running or not running.
 *
 * Uses `pidof` to match the exact process name. Only matches processes with exactly matching names
 * (e.g., "nginx" matches "nginx" but not "nginx-worker").
 *
 * @param options - Process wait configuration
 *
 * @example
 * // Wait for nginx to start
 * await waitProcess({ process: "nginx", state: "active" });
 *
 * @example
 * // Wait for a process to stop
 * await waitProcess({ process: "old-service", state: "terminated" });
 */
export async function waitProcess({
  process,
  state = 'active',
  delay = 1000,
}: WaitProcessOptions): Promise<void> {
  return task(
    `wait process ${process} [${state}]`,
    async (ctx) => {
      const targetActive = state === 'active';

      while (true) {
        ctx.signal.throwIfAborted();

        const { exitCode } = await sh(`pidof ${process};[ $? -eq 1 ]&&exit 64||exit $?`);
        const isActive = exitCode === 0;
        if (isActive === targetActive) {
          return;
        }

        await sleep(delay);
      }
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
