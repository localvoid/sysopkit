import { type Process } from '../utils/process.js';

// Configuration for creating a connector
export interface ConnectorOptions {
  readonly name?: string;
  readonly vars?: Record<string | symbol, any>;
}

/**
 * Interface for command transport to a target system.
 *
 * Connectors abstract how commands reach a host (local, SSH, container exec).
 * They are `AsyncDisposable` so that `using` or `await using` cleans up
 * resources (e.g. SSH ControlMaster sockets) automatically.
 *
 * - `rsh`: command prefix array prepended to spawned commands (e.g. `["ssh", "host", "--"]`); empty for local execution
 * - `connect()`: establish the transport (no-op for local)
 * - `spawn()`: run a command and return a `Process` handle
 */
export interface Connector extends AsyncDisposable {
  readonly host: string;
  readonly name: string;
  readonly vars: Record<string | symbol, any> | undefined;
  readonly rsh: string[];

  connect(signal?: AbortSignal): Promise<void>;

  spawn(cmd: string[], signal?: AbortSignal): Promise<Process>;
}

/**
 * Base class that implements the common parts of the Connector interface.
 *
 * Subclasses must implement `rsh` and `spawn()`. The default `connect()` and
 * `[Symbol.asyncDispose]()` are no-ops, suitable for local execution.
 */
export abstract class ConnectorBase implements Connector, AsyncDisposable {
  readonly host: string;
  readonly name: string;
  readonly vars: Record<string | symbol, any> | undefined;
  abstract readonly rsh: string[];

  constructor(
    host: string,
    name: string | undefined,
    vars: Record<string | symbol, any> | undefined,
  ) {
    this.host = host;
    this.name = name ?? host;
    this.vars = vars;
  }

  // No-op by default; override for transports that need setup (e.g. SSH)
  connect(_signal?: AbortSignal): Promise<void> {
    return Promise.resolve();
  }

  abstract spawn(cmd: string[], signal?: AbortSignal): Promise<Process>;

  // No-op by default; override to clean up transport resources
  [Symbol.asyncDispose](): PromiseLike<void> {
    return Promise.resolve();
  }
}
