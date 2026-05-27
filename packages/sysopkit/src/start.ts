/**
 * @module api/start
 *
 * Entry point for infrastructure automation workflows.
 */

import { createRootContext, runWithContext } from './core/context.js';
import {
  type Reporter,
  VERBOSITY_DEBUG,
  VERBOSITY_MINIMAL,
  VERBOSITY_NORMAL,
  VERBOSITY_TRACE,
} from './core/reporter.js';
import { ConsoleReporter } from './reporter/console.js';

/** Options for the start() entry point. */
export interface StartOptions {
  /** Custom reporter for output. Defaults to ConsoleReporter. */
  readonly reporter?: Reporter;
  /** Enable dry-run mode. Defaults to SYSOPKIT_DRY_RUN env var. */
  readonly dryRun?: boolean;
  /** External abort signal for cancellation. */
  readonly signal?: AbortSignal;
  /** Initial context variables (typed via symbol keys). */
  readonly vars?: Record<symbol | string, any>;
}

/** Result of a start() execution, indicating success or failure with duration. */
export type StartResult<T> =
  | { success: true; result: T; duration: number }
  | { success: false; error: unknown; duration: number };

/**
 * Entry point for infrastructure automation workflows.
 *
 * Creates a root execution context with a reporter, runs the provided
 * function, and returns a result object with success/failure status and
 * execution duration. Catches all errors and returns them in the result.
 */
export async function start<R>(
  fn: () => Promise<R>,
  options?: StartOptions,
): Promise<StartResult<R>> {
  const startTime = Date.now();
  const ctrl = new AbortController();
  const reporter =
    options?.reporter ??
    new ConsoleReporter({
      verbosity: _currentVerbosity(),
    });
  const dryRun = options?.dryRun ?? !!process.env['SYSOPKIT_DRY_RUN'];
  const signal = options?.signal ? AbortSignal.any([options.signal]) : ctrl.signal;

  process.once('SIGINT', () => {
    console.error('\nCtrl+C detected. Aborting...');
    ctrl.abort();
  });

  const ctx = createRootContext(reporter, dryRun, options?.vars, signal);
  try {
    const result = await runWithContext(ctrl, ctx, fn);
    return { success: true, result, duration: Date.now() - startTime };
  } catch (error: unknown) {
    return { success: false, error, duration: Date.now() - startTime };
  }
}

/** Reads SYSOPKIT_VERBOSITY env var and returns the corresponding verbosity level. */
function _currentVerbosity() {
  const v = process.env['SYSOPKIT_VERBOSITY'];
  if (v !== void 0) {
    switch (v) {
      case 'minimal':
        return VERBOSITY_MINIMAL;
      case 'normal':
        return VERBOSITY_NORMAL;
      case 'trace':
        return VERBOSITY_TRACE;
      case 'debug':
        return VERBOSITY_DEBUG;
    }
    console.error(
      `Invalid environment variable SYSOPKIT_VERBOSITY value '${v}'. Valid values: minimal, normal, trace, debug.`,
    );
  }
  return VERBOSITY_NORMAL;
}
