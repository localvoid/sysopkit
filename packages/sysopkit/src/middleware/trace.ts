/**
 * @module middleware/trace
 *
 * Process output tracing.
 *
 * Provides middleware to buffer and report process stdout/stderr via the reporter.
 */

import { type Connector } from '../core/connector.js';
import { type ExecutionContext } from '../core/context.js';
import { ConnectorMiddleware, middleware } from '../core/middleware.js';
import { STREAM_TRUE } from '../utils/constants.js';
import { type Process } from '../utils/process.js';
import { $_ } from '../utils/shell.js';

/** Configuration for trace output behavior. */
export interface TraceOptions {
  /** Enable stdout reporting (defaults to true). */
  readonly stdout?: boolean;
  /** Enable stderr reporting (defaults to true). */
  readonly stderr?: boolean;
  /** Custom handler for trace output events. */
  readonly on?: (type: 'stdout' | 'stderr', content: string) => void;
}

/**
 * Wraps execution to buffer process output and report it via the reporter.
 */
export function trace<R>(
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: TraceOptions,
): Promise<R> {
  return middleware('trace', fn, (next, ctx) => new TraceMiddleware(next, ctx, options), {
    info: () => ({
      stdout: options?.stdout === false ? 'disabled' : 'enabled',
      stderr: options?.stderr === false ? 'disabled' : 'enabled',
    }),
  });
}

/**
 * Middleware that pipes stdout/stderr through TransformStreams to buffer output.
 * On stream flush, reports the collected output via the context's reporter.
 */
export class TraceMiddleware extends ConnectorMiddleware {
  /** Execution context for reporter access. */
  private ctx: ExecutionContext;
  /** Whether to trace stdout. */
  private stdout: boolean;
  /** Whether to trace stderr. */
  private stderr: boolean;
  /** Custom output handler callback. */
  private on?: (type: 'stdout' | 'stderr', content: string) => void;

  constructor(next: Connector, ctx: ExecutionContext, options?: TraceOptions) {
    super(next);
    this.ctx = ctx;
    this.stdout = options?.stdout ?? true;
    this.stderr = options?.stderr ?? true;
    this.on = options?.on;
  }

  override async spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    const proc = await super.spawn(cmd, signal);
    let stdout = proc.stdout;
    let stderr = proc.stderr;

    if (this.stdout) {
      const decoder = new TextDecoder();
      const buffer: string[] = [];
      const stdoutTransform = new TransformStream<Uint8Array, Uint8Array>({
        transform: (chunk, controller) => {
          buffer.push(decoder.decode(chunk, STREAM_TRUE));
          controller.enqueue(chunk);
        },
        flush: () => {
          const output = buffer.join(' ').trim();
          if (output) {
            this.ctx.reporter.info(this.ctx, `${cmd.map($_).join(' ')}\n${output}`);
            this.on?.('stdout', output);
          }
        },
      });
      stdout = proc.stdout.pipeThrough(stdoutTransform);
    }

    if (this.stderr) {
      const decoder = new TextDecoder();
      const buffer: string[] = [];
      const stderrTransform = new TransformStream<Uint8Array, Uint8Array>({
        transform: (chunk, controller) => {
          buffer.push(decoder.decode(chunk, STREAM_TRUE));
          controller.enqueue(chunk);
        },
        flush: () => {
          const output = buffer.join(' ').trim();
          if (output) {
            this.ctx.reporter.error(this.ctx, `${cmd.map($_).join(' ')}\n${output}`);
            this.on?.('stderr', output);
          }
        },
      });
      stderr = proc.stderr.pipeThrough(stderrTransform);
    }

    return {
      ...proc,
      stdout,
      stderr,
    };
  }
}
