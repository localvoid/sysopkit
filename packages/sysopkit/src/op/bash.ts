/**
 * @module op/bash
 */

import { TEXT_DECODER } from '../utils/constants.js';
import { type ExecOptions, type ExecOutput, type ExecResult } from '../utils/process.js';
import { exec } from './exec.js';
import { ShellError } from './sh.js';

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
