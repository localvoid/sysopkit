import { type Connector } from '../core/connector.js';
import {
  context,
  createApplyContext,
  createConnectorContext,
  type ExecutionContext,
  runWithContext,
} from '../core/context.js';

export type ApplyResult<T> = ApplySuccess<T> | ApplyFailure;

export interface ApplySuccess<T> {
  readonly success: true;
  readonly conn: Connector;
  readonly result: T;
}

export interface ApplyFailure {
  readonly success: false;
  readonly conn: Connector;
  readonly error: unknown;
}

/** Options for single-connector apply. */
export interface ApplyOptions {
  readonly vars?: Record<symbol | string, any>;
}

/** Options for multi-connector apply with batching and failure thresholds. */
export interface ApplyArrayOptions extends ApplyOptions {
  readonly batchSize?: number;
  readonly maxFailPercent?: number;
}

/**
 * Orchestrates operations across one or more connectors.
 *
 * Single-connector mode: connects, creates a connector context, runs `fn`, and
 * returns the result directly. Throws `ApplyError` on failure.
 *
 * Multi-connector mode: processes hosts in parallel batches (default 5), tracks
 * failures, and throws `ApplyError` if `maxFailPercent` threshold is exceeded.
 * Returns an array of per-host results (successes and failures).
 */
export function apply<R>(
  name: string,
  connector: Connector,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: ApplyOptions,
): Promise<{ success: true; conn: Connector; result: R }>;
export function apply<R>(
  name: string,
  connectors: Connector[],
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: ApplyArrayOptions,
): Promise<ApplyResult<R>[]>;
export function apply<R>(
  name: string,
  connections: Connector | Connector[],
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: ApplyArrayOptions,
): Promise<ApplyResult<R> | ApplyResult<R>[]> {
  const parent = context();
  const ctrl = new AbortController();
  const signal = AbortSignal.any([parent.signal, ctrl.signal]);
  const ctx = createApplyContext(parent, options?.vars, signal, name);

  return runWithContext(ctrl, ctx, async (ctx) => {
    if (Array.isArray(connections)) {
      const batchSize = options?.batchSize ?? 5;
      const maxFailPercent = options?.maxFailPercent ?? 100;
      const failLimit = Math.ceil((connections.length * maxFailPercent) / 100);

      const results: ApplyResult<R>[] = [];
      let failCount = 0;

      // Process connectors in batches, marking remaining hosts as failures if threshold is exceeded
      const processBatch = async (batch: Connector[]) => {
        const batchResults = await Promise.all(
          batch.map((connection) => _apply(ctx, connection, fn)),
        );
        results.push(...batchResults);
        for (const result of batchResults) {
          if (!result.success) {
            failCount++;
          }
        }
      };

      if (batchSize === Infinity) {
        await processBatch(connections);
      } else {
        for (let i = 0; i < connections.length; i += batchSize) {
          await processBatch(connections.slice(i, i + batchSize));
          if (failCount > failLimit) {
            const error = new Error('Aborted due to max failures exceeded');
            for (let j = i + batchSize; j < connections.length; j += batchSize) {
              const remaining = connections.slice(j, j + batchSize);
              for (const conn of remaining) {
                results.push({
                  success: false,
                  conn,
                  error,
                });
              }
            }
            throw new ApplyError(
              _filterErrors(results),
              `apply failed: ${failCount}/${connections.length} hosts failed (threshold: ${failLimit})`,
              results,
            );
          }
        }
      }

      if (failCount > 0) {
        if (failCount > failLimit) {
          throw new ApplyError(
            _filterErrors(results),
            `apply failed: ${failCount}/${connections.length} hosts failed (threshold: ${failLimit})`,
            results,
          );
        }
      }

      return results;
    }

    const result = await _apply(ctx, connections, fn);
    if (!result.success) {
      throw new ApplyError([result.error], `failed to apply changes on '${connections.name}'`, [
        result,
      ]);
    }
    return result;
  });
}

function _filterErrors(results: ApplyResult<any>[]): unknown[] {
  return results.filter((r) => !r.success).map((r) => r.error);
}

async function _apply<R>(
  parent: ExecutionContext,
  conn: Connector,
  fn: (ctx: ExecutionContext) => Promise<R>,
): Promise<ApplyResult<R>> {
  const ctrl = new AbortController();
  const signal = AbortSignal.any([parent.signal, ctrl.signal]);

  const ctx = createConnectorContext(parent, conn, void 0, signal, conn.name);
  return await runWithContext(ctrl, ctx, async (ctx) => {
    await conn.connect(signal);
    try {
      const result = await fn(ctx);
      return { success: true, conn, result };
    } catch (error: unknown) {
      ctx.reporter.ctxError(ctx, error);
      return { success: false, conn, error };
    }
  });
}

/**
 * Thrown when apply fails across one or more connectors. Extends AggregateError with per-host
 * results.
 */
export class ApplyError<R = unknown> extends AggregateError {
  constructor(
    errors: unknown[],
    message: string,
    public readonly results: ApplyResult<R>[],
  ) {
    super(errors, message);
    this.name = 'ApplyError';
  }
}
