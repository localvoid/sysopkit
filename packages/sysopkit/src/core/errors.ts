/**
 * @module errors
 *
 * Error types used throughout the execution pipeline.
 */

import type { Connector } from './connector.js';

/**
 * Thrown when a connector-level operation fails (connect, spawn, dispose).
 * Carries a reference to the connector that failed.
 */
export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly conn: Connector,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

/**
 * Thrown when an operation is cancelled via AbortController or `abort()`.
 * Used to distinguish intentional cancellation from other failures.
 */
export class AbortError extends Error {
  constructor(message = 'Aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * Thrown when an operation (file, package, service, etc.) encounters an error.
 * Wraps the underlying cause for diagnostic chaining.
 */
export class OperationError extends Error {
  override readonly name = 'OperationError';

  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }
}

/**
 * Type guard to identify any error that represents an abort/cancellation.
 * Checks the `name` property rather than instanceof to catch AbortErrors
 * thrown across realm boundaries.
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}
