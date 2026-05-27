/**
 * @module op/bash
 */

import { task } from '../core/context.js';
import { VERBOSITY_TRACE } from '../core/reporter.js';
import { sleep } from '../core/sleep.js';
import { TEXT_DECODER } from '../utils/constants.js';
import { type ExecOptions, type ExecOutput, type ExecResult } from '../utils/process.js';
import { exec } from './exec.js';
import { $_, ShellError } from './sh.js';

/**
 * Executes a command using `bash -c`.
 *
 * Throws `ShellError` if the command exits with a non-zero code outside the range 64-78 (standard
 * BSD exit codes for usage errors).
 */
export async function bash<
  const Out extends ExecOutput = 'text',
  const Err extends ExecOutput = 'text',
>(cmd: string, options?: ExecOptions<Out, Err>): Promise<ExecResult<Out, Err>> {
  const cmds = ['bash', '-c', cmd];
  const result = await exec(cmds, options);
  const exitCode = result.exitCode;
  if (exitCode !== 0 && (exitCode < 64 || exitCode > 78)) {
    const stdout =
      options?.stdout === 'buffer'
        ? TEXT_DECODER.decode(result.stdout as Uint8Array)
        : (result.stdout as string);
    const stderr =
      options?.stderr === 'buffer'
        ? TEXT_DECODER.decode(result.stderr as Uint8Array)
        : (result.stderr as string);
    throw new ShellError('failed to execute bash command', cmds, exitCode, stdout, stderr);
  }
  return result;
}

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
 * Uses bash's `/dev/tcp` pseudo-device to test connectivity without requiring external tools like
 * `nc` or `nmap`.
 *
 * @param options - Port wait configuration
 *
 * @example
 * // Wait for a service to start
 * await waitPort({ host: "localhost", port: 8080 });
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
    `wait port ${host}:${port} [${state}]`,
    async (ctx) => {
      const targetState = state === 'open';
      while (true) {
        ctx.signal.throwIfAborted();

        const { exitCode } = await bash(`echo >${$_(`/dev/tcp/${host}/${port}`)}||exit 64`);
        const isOpen = exitCode === 0;
        if (isOpen === targetState) {
          return;
        }

        await sleep(delay);
      }
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
