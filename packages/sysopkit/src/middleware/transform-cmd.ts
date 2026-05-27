/**
 * @module middleware/transform-cmd
 *
 * Command transformation.
 *
 * Provides middleware to modify command arrays before execution.
 */

import { type Connector } from '../core/connector.js';
import { ConnectorMiddleware } from '../core/middleware.js';
import { type Process } from '../utils/process.js';

/**
 * Middleware that transforms command arrays before execution.
 *
 * Useful for prefixing commands (e.g., wrapping in a shell), adding flags,
 * or redirecting output. The transform function receives the original command
 * array and returns the modified array.
 */
export class TransformCmdMiddleware extends ConnectorMiddleware {
  /** Function that transforms command arrays. */
  protected transform: (cmd: string[]) => string[];

  constructor(next: Connector, transform: (cmd: string[]) => string[]) {
    super(next);
    this.transform = transform;
  }

  override spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    return super.spawn(this.transform(cmd), signal);
  }
}
