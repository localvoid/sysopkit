import { spawn as nodeSpawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';

/** A spawned process with web stream interfaces. */
export interface Process {
  /** Writable stream for process stdin. */
  readonly stdin: WritableStream;
  /** Readable stream for process stdout. */
  readonly stdout: ReadableStream;
  /** Readable stream for process stderr. */
  readonly stderr: ReadableStream;
  /** Promise that resolves with the exit code when the process exits. */
  readonly exited: Promise<number>;
  /** Terminate the process. */
  kill(code?: number): void;
}

/**
 * Spawns a child process and returns a Process object with web streams.
 *
 * Uses Node.js spawn under the hood but exposes WHATWG streams for
 * stdin/stdout/stderr.
 */
export function processSpawn(
  cmd: string[],
  signal?: AbortSignal,
  env?: NodeJS.ProcessEnv,
): Process {
  const cp = nodeSpawn(cmd[0], cmd.slice(1), {
    stdio: 'pipe',
    signal,
    env,
  });

  return {
    stdin: Writable.toWeb(cp.stdin),
    stdout: Readable.toWeb(cp.stdout),
    stderr: Readable.toWeb(cp.stderr),
    exited: new Promise((resolve, reject) => {
      cp.on('exit', (code) => resolve(code ?? 0));
      cp.on('error', reject);
    }),
    kill: (code) => cp.kill(code),
  };
}

/** Output format for exec operations. */
export type ExecOutput = 'text' | 'buffer';

/** Result type based on the requested output format. */
export type ExecOutputResult<T extends ExecOutput> = T extends 'buffer'
  ? Uint8Array<ArrayBuffer>
  : string;

/** Configuration options for executing a command. */
export interface ExecOptions<Out extends ExecOutput = 'text', Err extends ExecOutput = 'text'> {
  /** Data to write to stdin. */
  readonly stdin?: Uint8Array | string;
  /** Output format for stdout (defaults to "text"). */
  readonly stdout?: Out;
  /** Output format for stderr (defaults to "text"). */
  readonly stderr?: Err;
  /** AbortSignal for cancellation. */
  readonly signal?: AbortSignal;
}

/** Result from executing a command. */
export interface ExecResult<Out extends ExecOutput = 'text', Err extends ExecOutput = 'text'> {
  /** Standard output content. */
  readonly stdout: ExecOutputResult<Out>;
  /** Standard error content. */
  readonly stderr: ExecOutputResult<Err>;
  /** Process exit code. */
  readonly exitCode: number;
}

/** Error thrown when a command exits with a non-zero status. */
export class ExecError extends Error {
  readonly cmd: string[];
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, cmd: string[], exitCode: number, stdout: string, stderr: string) {
    super(message);
    this.name = 'ExecError';
    this.cmd = cmd;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * Executes a command and captures its output.
 *
 * Returns stdout and stderr as text or buffer based on options.
 */
export async function processExec<Out extends ExecOutput = 'text', Err extends ExecOutput = 'text'>(
  cmd: string[],
  options?: ExecOptions<Out, Err>,
  env?: NodeJS.ProcessEnv,
): Promise<ExecResult<Out, Err>> {
  const proc = processSpawn(cmd, options?.signal, env);
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    (options?.stdout === 'buffer' ? buffer(proc.stdout) : text(proc.stdout)) as Promise<
      ExecOutputResult<Out>
    >,
    (options?.stderr === 'buffer' ? buffer(proc.stderr) : text(proc.stderr)) as Promise<
      ExecOutputResult<Err>
    >,
  ]);
  return {
    exitCode,
    stdout,
    stderr,
  };
}
