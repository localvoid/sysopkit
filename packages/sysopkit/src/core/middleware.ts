import { type Process } from '../utils/process.js';
import { type Connector } from './connector.js';
import { context, ExecutionContext, runWithContext } from './context.js';
import { VERBOSITY_DEBUG } from './reporter.js';

/**
 * Base class for connector middleware using the decorator pattern.
 *
 * All methods delegate to the wrapped `next` connector by default. Subclasses
 * override specific methods to intercept or transform behavior (e.g. prepending
 * `sudo`, tracing output, matching prompts).
 */
export abstract class ConnectorMiddleware implements Connector {
  constructor(protected readonly next: Connector) {}

  get host(): string {
    return this.next.host;
  }

  get name(): string {
    return this.next.name;
  }

  get vars(): Record<string | symbol, any> | undefined {
    return this.next.vars;
  }

  get rsh(): string[] {
    return this.next.rsh;
  }

  connect(signal?: AbortSignal): Promise<void> {
    return this.next.connect(signal);
  }

  spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    return this.next.spawn(cmd, signal);
  }

  [Symbol.asyncDispose](): PromiseLike<void> {
    return this.next[Symbol.asyncDispose]();
  }
}

/** Options for the middleware context. */
export interface MiddlewareContextOptions {
  readonly info?: string | (() => string | Record<string, string | number | undefined>);
}

/**
 * Wrap the current connector with middleware and run `fn` in the new context.
 *
 * Creates a middleware-level child context where the connector is the result of
 * calling `middleware(parent.conn, parent)`. The child context runs at DEBUG
 * verbosity. Throws if the current context has no connector.
 */
export function middleware<R>(
  name: string,
  fn: (ctx: ExecutionContext) => Promise<R>,
  middleware: (next: Connector, ctx: ExecutionContext) => Connector,
  options?: MiddlewareContextOptions,
): Promise<R> {
  const parent = context();
  if (parent.conn === null) {
    throw new Error("unable to attach a middleware: current context doesn't have a connector");
  }
  const ctrl = new AbortController();
  const signal = AbortSignal.any([parent.signal, ctrl.signal]);

  const ctx = new ExecutionContext(
    'middleware',
    parent,
    parent.reporter,
    middleware(parent.conn, parent),
    parent.dryRun,
    void 0,
    signal,
    name,
    options?.info,
    VERBOSITY_DEBUG,
  );
  return runWithContext(ctrl, ctx, fn);
}
