import { type Connector } from './connector.js';
import { context } from './context.js';
import { ConnectorMiddleware } from './middleware.js';

/**
 * Mutate the current (base) connector's options in place.
 *
 * Unwraps any `ConnectorMiddleware` chain to reach the underlying connector
 * and invokes `fn` with it, so callers can narrow with `instanceof`:
 *
 * ```ts
 * import { updateConnectorOptions } from 'sysopkit';
 * import { SSHConnector } from 'sysopkit/connector/ssh';
 *
 * updateConnectorOptions((conn) => {
 *   if (conn instanceof SSHConnector) {
 *     conn.disableStrictHostKeyChecking();
 *   } else {
 *     throw new Error(`refusing: unsupported connector '${conn.name}'`);
 *   }
 * });
 * ```
 *
 * Operates only on the ambient context's connector (`context().conn`);
 * throws when there is none. Intended for single-connector flows — do not
 * mutate a connector shared across parallel `apply()` batches.
 */
export function updateConnectorOptions<R>(fn: (conn: Connector) => R): R {
  if (typeof fn !== 'function') {
    throw new Error('refusing: updateConnectorOptions requires a function');
  }
  const ctx = context();
  if (ctx.conn === null) {
    throw new Error("unable to update connector options: current context doesn't have a connector");
  }
  let target: Connector = ctx.conn;
  while (target instanceof ConnectorMiddleware) {
    target = target.next;
  }
  return fn(target);
}
