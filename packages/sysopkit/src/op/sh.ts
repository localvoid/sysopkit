/**
 * @module op/sh
 *
 * Shell command execution and error handling.
 */

import { TEXT_DECODER } from '../utils/constants.js';
import { ExecError, type ExecOptions, type ExecOutput, type ExecResult } from '../utils/process.js';
import { exec } from './exec.js';
export { $_, parseShellConf } from '../utils/shell.js';

/**
 * Error class for shell command failures.
 *
 * Extends ExecError with a formatted toString that includes the command,
 * exit code, stdout, and stderr for debugging.
 */
export class ShellError extends ExecError {
  constructor(message: string, cmd: string[], exitCode: number, stdout: string, stderr: string) {
    super(message, cmd, exitCode, stdout, stderr);
    this.name = 'ShellError';
  }

  override toString(): string {
    return `${this.message}\nCMD: ${this.cmd.join(' ')}\nEXIT CODE: ${this.exitCode}\nSTDERR: ${this.stderr}\nSTDOUT: ${this.stdout}`;
  }
}

/**
 * Executes a command using `sh -c`.
 *
 * Throws `ShellError` if the command exits with a non-zero code outside
 * the range 64-78 (standard BSD exit codes for usage errors).
 */
export async function sh<
  const Out extends ExecOutput = 'text',
  const Err extends ExecOutput = 'text',
>(cmd: string, options?: ExecOptions<Out, Err>): Promise<ExecResult<Out, Err>> {
  const cmds = ['sh', '-c', cmd];
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
    throw new ShellError('failed to execute shell command', cmds, exitCode, stdout, stderr);
  }
  return result;
}
