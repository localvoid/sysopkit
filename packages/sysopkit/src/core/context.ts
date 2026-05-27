/**
 * @module context
 *
 * Central execution context propagated across async boundaries via AsyncLocalStorage.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { type Connector } from './connector.js';
import { AbortError } from './errors.js';
import { CHANGE_EVENT, type ChangeEntry, type Event } from './events.js';
import {
  VERBOSITY_DEBUG,
  VERBOSITY_MINIMAL,
  VERBOSITY_NORMAL,
  type Reporter,
  type Verbosity,
} from './reporter.js';
import { type Var } from './vars.js';

export type ContextType = 'root' | 'apply' | 'connector' | 'middleware' | 'utility' | 'task';

/**
 * Carries all state for a single frame of execution.
 *
 * Contexts form a tree via the `parent` reference. Variables (`vars`) are looked
 * up by walking from the current context to the root. Events propagate up the
 * same chain.
 */
export class ExecutionContext {
  readonly type: ContextType;
  readonly parent: ExecutionContext | null;
  readonly reporter: Reporter;
  readonly conn: Connector | null;
  readonly dryRun: boolean;
  readonly name: string;
  readonly details:
    | undefined
    | string
    | (() => string | Record<string, string | number | undefined>);
  readonly vars: Record<symbol | string, any> | undefined;
  readonly signal: AbortSignal;
  readonly verbosity: Verbosity;
  eventHandlers: null | Map<Event<any>, Array<(data: unknown) => void>>;

  constructor(
    type: ContextType,
    parent: ExecutionContext | null,
    reporter: Reporter,
    conn: Connector | null,
    dryRun: boolean,
    vars: Record<symbol | string, any> | undefined,
    signal: AbortSignal,
    name: string,
    details: undefined | string | (() => string | Record<string, string | number | undefined>),
    verbosity: Verbosity,
  ) {
    this.type = type;
    this.parent = parent;
    this.reporter = reporter;
    this.conn = conn;
    this.dryRun = dryRun;
    this.vars = vars;
    this.signal = signal;
    this.name = name;
    this.details = details;
    this.verbosity = verbosity;
    this.eventHandlers = null;
  }

  /**
   * Walk the parent chain to find a typed context variable, returning undefined if absent.
   */
  tryGet<T>(key: Var<T> | string): T | undefined {
    let current: ExecutionContext | null = this;
    while (current !== null) {
      if (current.vars !== void 0 && key in current.vars) {
        return current.vars[key] as T;
      }
      current = current.parent;
    }
    return void 0;
  }

  /**
   * Walk the parent chain to find a typed context variable, throwing if absent.
   */
  get<T>(key: Var<T> | string): T {
    const value = this.tryGet(key);
    if (value === void 0) {
      throw Error(`context variable '${String(key)}' not found`);
    }
    return value as T;
  }

  /**
   * Force-terminate the current context with an AbortError.
   *
   * Reports the abort reason and throws, unwinding the context stack.
   */
  abort(reason = 'Aborted by user'): never {
    this.error(`Context aborted: ${reason}`);
    throw new AbortError(reason);
  }

  /**
   * Register an event handler on the current context.
   *
   * Handlers are stored lazily on `ctx.eventHandlers` and fire when `emit()` is
   * called on the same or a descendant context.
   */
  on<T extends {} | undefined>(event: Event<T>, handler: (data?: T) => void): void;
  on<T extends {}>(event: Event<T>, handler: (data: T) => void): void;
  on<T>(event: Event<T>, handler: (data?: T) => void): void {
    if (this.eventHandlers === null) {
      this.eventHandlers = new Map();
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.push(handler as (data: unknown) => void);
    } else {
      this.eventHandlers.set(event, [handler as (data: unknown) => void]);
    }
  }

  info(message: string): void {
    this.reporter.info(this, message);
  }

  warn(message: string): void {
    this.reporter.warn(this, message);
  }

  error(message: string): void {
    this.reporter.error(this, message);
  }
}

/**
 * Creates a root-level execution context with no parent.
 */
export function createRootContext(
  reporter: Reporter,
  dryRun: boolean,
  vars: Record<symbol | string, any> | undefined,
  signal: AbortSignal,
): ExecutionContext {
  return new ExecutionContext(
    'root',
    null,
    reporter,
    null,
    dryRun,
    vars,
    signal,
    '',
    void 0,
    VERBOSITY_MINIMAL,
  );
}

/**
 * Creates an apply-level context.
 */
export function createApplyContext(
  parent: ExecutionContext,
  vars: Record<symbol | string, any> | undefined,
  signal: AbortSignal,
  name: string,
): ExecutionContext {
  return new ExecutionContext(
    'apply',
    parent,
    parent.reporter,
    null,
    parent.dryRun,
    vars,
    signal,
    name,
    void 0,
    VERBOSITY_MINIMAL,
  );
}

/**
 * Creates a connector-level context.
 */
export function createConnectorContext(
  parent: ExecutionContext,
  conn: Connector,
  vars: Record<symbol | string, any> | undefined,
  signal: AbortSignal,
  name: string,
): ExecutionContext {
  return new ExecutionContext(
    'connector',
    parent,
    parent.reporter,
    conn,
    parent.dryRun,
    vars,
    signal,
    name,
    void 0,
    VERBOSITY_MINIMAL,
  );
}

/**
 * Creates a task-level context for user-facing units of work.
 */
export function createTaskContext(
  parent: ExecutionContext,
  vars: Record<symbol | string, any> | undefined,
  signal: AbortSignal,
  name: string,
  info: undefined | string | (() => string | Record<string, string | number | undefined>),
  verbosity: Verbosity,
): ExecutionContext {
  return new ExecutionContext(
    'task',
    parent,
    parent.reporter,
    parent.conn,
    parent.dryRun,
    vars,
    signal,
    name,
    info,
    verbosity,
  );
}

/**
 * Creates an utility-level context for internal helpers.
 */
export function createUtilityContext(
  parent: ExecutionContext,
  vars: Record<symbol | string, any> | undefined,
  signal: AbortSignal,
  name: string,
): ExecutionContext {
  return new ExecutionContext(
    'utility',
    parent,
    parent.reporter,
    parent.conn,
    parent.dryRun,
    vars,
    signal,
    name,
    void 0,
    VERBOSITY_DEBUG,
  );
}

// AsyncLocalStorage instance that propagates ExecutionContext across async boundaries
const ALS = new AsyncLocalStorage<ExecutionContext>();

/**
 * Returns the current execution context from AsyncLocalStorage.
 *
 * Throws if called outside of a `runWithContext()` scope.
 */
export function context(): ExecutionContext {
  const store = ALS.getStore();
  if (!store) {
    throw new Error('No context available');
  }
  return store;
}

/**
 * Enter an ALS scope for `ctx`, run `fn`, and manage reporter lifecycle hooks.
 *
 * On success: calls `ctxStart` before and `ctxEnd` after `fn`.
 * On error: calls `ctxError`, aborts the controller, and re-throws.
 * In finally: aborts the controller with "exit context frame" if not already
 * aborted, ensuring any lingering async work tied to this context is cancelled.
 */
export async function runWithContext<R>(
  ctrl: AbortController,
  ctx: ExecutionContext,
  fn: (ctx: ExecutionContext) => Promise<R>,
): Promise<R> {
  ctx.reporter.ctxStart(ctx);

  try {
    return await ALS.run(ctx, fn, ctx);
  } catch (e: any) {
    ctx.reporter.ctxError(ctx, e);
    ctrl.abort(e);
    throw e;
  } finally {
    ctx.reporter.ctxEnd(ctx);
    if (!ctrl.signal.aborted) {
      ctrl.abort('exit context frame');
    }
  }
}

// Options for creating a task-level context
export interface TaskOptions {
  readonly details?: string | (() => string | Record<string, string | number | undefined>);
  readonly verbosity?: Verbosity;
  readonly vars?: Record<string, any>;
  readonly signal?: AbortSignal;
}

/**
 * Create a child task context and run `fn` within it.
 *
 * Tasks are user-facing units of work. They default to NORMAL verbosity and
 * accept an optional `info` string/function for reporting.
 */
export function task<R>(
  name: string,
  fn: (ctx: ExecutionContext) => Promise<R>,
  opts?: TaskOptions,
): Promise<R> {
  const parent = context();
  const ctrl = new AbortController();
  const signal = AbortSignal.any(
    opts?.signal === void 0
      ? [parent.signal, ctrl.signal]
      : [parent.signal, ctrl.signal, opts.signal],
  );

  const ctx = createTaskContext(
    parent,
    opts?.vars,
    signal,
    name,
    opts?.details,
    opts?.verbosity ?? VERBOSITY_NORMAL,
  );
  return runWithContext(ctrl, ctx, fn);
}

/**
 * Options for creating a utility-level context.
 */
export interface UtilityOptions {
  readonly vars?: Record<string | symbol, any>;
  readonly signal?: AbortSignal;
}

/**
 * Create a child utility context and run `fn` within it.
 *
 * Utilities are internal helpers that run at DEBUG verbosity and do not
 * produce user-facing output by default.
 */
export function utility<R>(
  name: string,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: UtilityOptions,
): Promise<R> {
  const parent = context();
  const ctrl = new AbortController();
  const sig = options?.signal
    ? AbortSignal.any([parent.signal, ctrl.signal, options.signal])
    : AbortSignal.any([parent.signal, ctrl.signal]);

  const ctx = createUtilityContext(parent, options?.vars, sig, name);
  return runWithContext(ctrl, ctx, fn);
}

/**
 * Emit an event to the reporter and propagate it up the parent chain.
 *
 * Notifies the reporter first, then walks up to each ancestor context,
 * invoking any handlers registered via `on()` at each level.
 */
export function emit<T extends {} | undefined>(event: Event<T>, data?: T): void;
export function emit<T extends {}>(event: Event<T>, data: T): void;
export function emit<T>(event: Event<T>, data?: T): void {
  const ctx = context();
  ctx.reporter.onEvent(ctx, event, data);
  _propagateEvent(ctx, event, data);
}

// Convenience to emit a CHANGE_EVENT with ChangeEntry data
export function emitChanged(entries: ChangeEntry | ChangeEntry[]): void {
  return emit(CHANGE_EVENT, entries);
}

/**
 * Register a CHANGE_EVENT handler for the duration of `fn`.
 *
 * Creates a utility context, attaches the handler via `on()`, runs `fn`, and
 * discards the handler when the context ends.
 */
export async function onChange<R>(
  handler: (event: ChangeEntry | ChangeEntry[]) => void,
  fn: () => R | Promise<R>,
): Promise<R> {
  return utility('onChange', async (ctx) => {
    ctx.on(CHANGE_EVENT, handler as (data: unknown) => void);
    return fn();
  });
}

// Recursively walk the parent chain, invoking handlers at each context level
function _propagateEvent<T>(ctx: ExecutionContext, event: Event<T>, data: T): void {
  if (ctx.eventHandlers !== null) {
    const handlers = ctx.eventHandlers.get(event);
    if (handlers !== void 0) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  if (ctx.parent !== null) {
    _propagateEvent(ctx.parent, event, data);
  }
}
