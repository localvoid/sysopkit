/**
 * @module op/exec
 *
 * Process spawning and command execution.
 */

import { buffer, text } from 'node:stream/consumers';

import type {
  ExecOptions,
  ExecOutput,
  ExecOutputResult,
  ExecResult,
  Process,
} from '../utils/process.js';
import { context } from '../core/context.js';
import { TEXT_ENCODER } from '../utils/constants.js';

export type {
  ExecError,
  ExecOptions,
  ExecOutput,
  ExecOutputResult,
  ExecResult,
} from '../utils/process.js';

/**
 * Spawns a process using the current connector.
 *
 * Requires an active connection. Combines the provided signal with the
 * execution context signal if both are present.
 *
 * @param cmd - Command and arguments as an array
 * @param signal - Optional abort signal
 * @returns Process handle with stdin, stdout, stderr streams and exited promise
 */
export function spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
  const ctx = context();
  if (ctx.conn === null) {
    throw new Error('require connection');
  }
  ctx.reporter.spawn(ctx, cmd);
  return ctx.conn.spawn(cmd, signal ? AbortSignal.any([ctx.signal, signal]) : ctx.signal);
}

/**
 * Executes a command with arguments and collects output.
 *
 * Spawns a process, optionally pipes stdin, and returns exit code with
 * stdout/stderr as either text or buffer based on options.
 *
 * @param cmd - Command and arguments as an array
 * @param options - Execution options including stdin, stdout, stderr format
 * @returns Object with exitCode, stdout, and stderr
 */
export async function exec<
  const Out extends ExecOutput = 'text',
  const Err extends ExecOutput = 'text',
>(cmd: string[], options?: ExecOptions<Out, Err>): Promise<ExecResult<Out, Err>> {
  const proc = await spawn(cmd, options?.signal);
  let stdin;
  if (options?.stdin) {
    const content = new ReadableStream({
      start(controller) {
        controller.enqueue(
          typeof options.stdin === 'string' ? TEXT_ENCODER.encode(options.stdin) : options.stdin,
        );
        controller.close();
      },
    });
    stdin = content.pipeTo(proc.stdin);
  }
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    (options?.stdout === 'buffer' ? buffer(proc.stdout) : text(proc.stdout)) as Promise<
      ExecOutputResult<Out>
    >,
    (options?.stderr === 'buffer' ? buffer(proc.stderr) : text(proc.stderr)) as Promise<
      ExecOutputResult<Err>
    >,
    stdin,
  ]);
  return {
    exitCode,
    stdout,
    stderr,
  };
}
