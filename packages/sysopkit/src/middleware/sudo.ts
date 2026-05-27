/**
 * @module middleware/sudo
 *
 * Privilege escalation.
 *
 * Provides functions to execute commands with elevated privileges using sudo.
 */

import { randomUUID } from 'node:crypto';

import { type Connector } from '../core/connector.js';
import { context, type ExecutionContext } from '../core/context.js';
import { ConnectorMiddleware, middleware } from '../core/middleware.js';
import { type Var } from '../core/vars.js';
import { STREAM_TRUE, TEXT_ENCODER } from '../utils/constants.js';
import { type Process } from '../utils/process.js';

/** Configuration for sudo privilege escalation. */
export interface SudoOptions {
  /** Target user to run commands as (defaults to root) */
  readonly user?: string;
  /** Password for sudo authentication */
  readonly password?: string;
  /** SELinux role */
  readonly role?: string;
  /** Preserve environment variables; true for all, array for specific vars */
  readonly preserveEnv?: boolean | string[];
}

/**
 * Executes a function with sudo privilege escalation.
 */
export function sudo<R>(
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: SudoOptions,
): Promise<R> {
  const ctx = context();
  const user = options?.user ?? ctx.tryGet(SUDO_USER);
  const password = options?.password ?? ctx.tryGet(SUDO_PASSWORD);
  const role = options?.role ?? ctx.tryGet(SUDO_ROLE);
  const preserveEnv = options?.preserveEnv ?? ctx.tryGet(SUDO_PRESERVE_ENV);

  return middleware(
    'sudo',
    fn,
    (next) => new SudoMiddleware(next, user, password, role, preserveEnv),
    {
      info: () => ({
        user,
        password: '<hidden>',
        role,
        PRESERVE_ENV: preserveEnv === true ? 'enabled' : void 0,
      }),
    },
  );
}

/** Variable for the sudo target user. */
export const SUDO_USER: Var<string> = Symbol('sysopkit.var.SUDO_USER');
/** Variable for the sudo password. */
export const SUDO_PASSWORD: Var<string> = Symbol('sysopkit.var.SUDO_PASSWORD');
/** Variable for environment variables to preserve during sudo. */
export const SUDO_PRESERVE_ENV: Var<boolean | string[]> = Symbol('sysopkit.var.SUDO_PRESERVE_ENV');
/** Variable for the SELinux role to use with sudo. */
export const SUDO_ROLE: Var<string> = Symbol('sysopkit.var.SUDO_ROLE');

/**
 * Middleware that wraps commands with sudo for privilege escalation.
 *
 * Uses a two-phase approach:
 * 1. Validate credentials once using `sudo -v -S` with password via stdin
 * 2. Run subsequent commands with `sudo -n` (non-interactive) within the cache timeout window
 */
export class SudoMiddleware extends ConnectorMiddleware {
  /** Target user for command execution. */
  readonly user: string | undefined;
  /** Password for sudo authentication (with trailing newline). */
  readonly password: Uint8Array | undefined;
  /** SELinux role for command execution. */
  readonly role: string | undefined;
  /** Environment variables to preserve. */
  readonly preserveEnv: boolean | string[] | undefined;

  constructor(
    next: Connector,
    user: string | undefined,
    password: string | undefined,
    role?: string,
    preserveEnv?: boolean | string[],
  ) {
    super(next);
    this.user = user;
    this.password = password !== void 0 ? TEXT_ENCODER.encode(password + '\n') : void 0;
    this.role = role;
    this.preserveEnv = preserveEnv;
  }

  override async spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    const cmds = ['sudo', '-H'];
    if (this.user) cmds.push('-u', this.user);
    if (this.role) cmds.push('-r', this.role);

    if (this.preserveEnv) {
      if (typeof this.preserveEnv === 'boolean') {
        cmds.push('-E');
      } else {
        cmds.push(`--preserve-env=${this.preserveEnv.join(',')}`);
      }
    }

    if (this.password) {
      // Use a unique prompt string to identify sudo's password prompt in stderr
      const prompt = `ASKPASS-${randomUUID()}`;
      cmds.push('-S', '-p', prompt, ...cmd);
      const proc = await super.spawn(cmds, signal);

      const procStdin = proc.stdin.getWriter();
      const stdinPromise = Promise.withResolvers();
      let stdinClosed = false;
      let stdinAborted = false;
      // Abort reason can be any value passed to stream.abort()
      let stdinAbortedReason: unknown;
      let responded = false;

      // Wraps the process stdin to defer writes until after the prompt response is sent.
      // Tracks close/abort state so pending operations can be replayed after response.
      const stdin = new WritableStream<Uint8Array>({
        async write(chunk) {
          await stdinPromise.promise;
          return procStdin.write(chunk);
        },
        close() {
          if (responded === true) {
            return procStdin.close();
          }
          stdinClosed = true;
        },
        abort(reason) {
          if (responded === true) {
            return procStdin.abort(reason);
          }
          stdinAbortedReason = reason;
          stdinAborted = true;
        },
      });

      // Intercepts stderr to detect the prompt pattern. On match, writes the response
      // to stdin, strips the matched text from stderr, and releases deferred stdin operations.
      const decoder = new TextDecoder();
      const stderrTransform = new TransformStream<Uint8Array, Uint8Array>({
        transform: async (chunk, controller) => {
          const text = decoder.decode(chunk, STREAM_TRUE);
          if (responded === false) {
            if (text.includes(prompt)) {
              await procStdin.write(this.password);
              responded = true;
              stdinPromise.resolve(void 0);
              if (stdinAborted) {
                await procStdin.abort(stdinAbortedReason);
                stdinAbortedReason = void 0;
              } else if (stdinClosed) {
                await procStdin.close();
              }

              chunk = TEXT_ENCODER.encode(text.replace(prompt, ''));
              if (chunk.length === 0) {
                return;
              }
            }
          } else {
            if (text.includes(prompt)) {
              throw new Error(`invalid sudo password`);
            }
          }
          controller.enqueue(chunk);
        },
      });

      return {
        ...proc,
        stdin,
        stderr: proc.stderr.pipeThrough(stderrTransform),
      };
    } else {
      // Use -n to fail rather than prompt
      cmds.push('-n', ...cmd);
      return super.spawn(cmds, signal);
    }
  }
}
