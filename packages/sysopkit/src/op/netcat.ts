/**
 * @module op/netcat
 *
 * TCP port waiting utilities using netcat.
 */

import { task } from '../core/context.js';
import { VERBOSITY_TRACE } from '../core/reporter.js';
import { sleep } from '../core/sleep.js';
import { $_, sh } from './sh.js';

/**
 * Configuration for waitPort operation.
 */
export interface WaitPortOptions {
  /** Port number to check. */
  readonly port: number;
  /** Host to connect to. Defaults to "localhost". */
  readonly host?: string;
  /** Desired port state. Defaults to "open". */
  readonly state?: 'open' | 'close';
  /** Delay between checks in milliseconds. Defaults to 100ms. */
  readonly delay?: number;
}

/**
 * Waits for a TCP port to reach the desired state.
 *
 * Uses `nc -z` (zero-I/O mode) to test connectivity without sending data.
 *
 * @param options - Port wait configuration
 *
 * @example
 * // Wait for a service to start
 * await waitPort({ host: "localhost", port: 8080, state: "open" });
 *
 * @example
 * // Wait for a service to stop
 * await waitPort({ host: "localhost", port: 8080, state: "closed" });
 */
export async function waitPort({
  port,
  host = 'localhost',
  state = 'open',
  delay = 100,
}: WaitPortOptions): Promise<void> {
  return task(
    `wait ${host}:${port} [${state}]`,
    async (ctx) => {
      const targetState = state === 'open';
      while (true) {
        ctx.signal.throwIfAborted();

        const { exitCode } = await sh(
          `nc -z -w 1' ${$_(host)} ${port};[ $? -eq 1 ]&&exit 64||exit $?`,
        );
        const isOpen = exitCode === 0;
        if (isOpen === targetState) return;

        await sleep(delay);
      }
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
