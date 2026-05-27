import type { ExecutionContext } from './context.js';
import type { Event } from './events.js';

export const VERBOSITY_MINIMAL = 0;
export const VERBOSITY_NORMAL = 1;
export const VERBOSITY_TRACE = 2;
export const VERBOSITY_DEBUG = 3;

export type Verbosity =
  | typeof VERBOSITY_MINIMAL
  | typeof VERBOSITY_NORMAL
  | typeof VERBOSITY_TRACE
  | typeof VERBOSITY_DEBUG;

/**
 * Interface for reporting execution events to the user.
 *
 * Implementations decide how to render output (console, JSON, silent, etc.).
 * Each method receives the context so the reporter can scope output to the
 * current task/connector hierarchy.
 */
export interface Reporter {
  /** Called when a context frame begins. */
  ctxStart(ctx: ExecutionContext): void;
  /** Called when a context frame ends normally. */
  ctxEnd(ctx: ExecutionContext): void;
  /** Called when a context frame terminates with an error. */
  ctxError(ctx: ExecutionContext, error: any): void;
  /** Called when an event is emitted. */
  onEvent<T>(ctx: ExecutionContext, event: Event<T>, data: T): void;
  /** Called when remote process is spawned. */
  spawn(ctx: ExecutionContext, cmd: string[]): void;
  /** Called before a retry attempt (used by retry()). */
  retryAttempt(ctx: ExecutionContext, attempt: number, delay: number, error: any): void;
  /** Informational message. */
  info(ctx: ExecutionContext, message: string): void;
  /** Warning message. */
  warn(ctx: ExecutionContext, message: string): void;
  /** Error message. */
  error(ctx: ExecutionContext, message: string): void;
}
