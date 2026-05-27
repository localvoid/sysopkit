import { type Connector, ConnectorBase, type ConnectorOptions } from '../core/connector.js';
import { ConnectorError } from '../core/errors.js';
import { type Process, processExec, processSpawn } from '../utils/process.js';

/** Options for creating a podman connector. */
export interface PodmanConnectorOptions extends ConnectorOptions {
  readonly host: string;
}

/**
 * Connector for executing commands inside a running podman container.
 *
 * Uses podman exec for command execution.
 */
export class PodmanConnector extends ConnectorBase {
  private _rsh: string[];

  constructor(options: PodmanConnectorOptions) {
    super(options.host, options.name ?? options.host, options.vars);
    this._rsh = ['podman', 'exec', '-i'];
  }

  override get rsh(): string[] {
    return this._rsh;
  }

  override async connect(signal?: AbortSignal): Promise<void> {
    const state = (await inspect(this, this.host, '{{.State.Status}}', signal)) as PodmanState;
    if (state !== 'running') {
      throw new ConnectorError(
        `Container '${this.host}' not running (container state: ${state})`,
        this,
      );
    }
  }

  async spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    return processSpawn([...this.rsh, this.host, ...cmd], signal);
  }
}

type PodmanState = 'running' | 'paused' | 'exited' | 'created';

/**
 * Retrieves container metadata using podman inspect.
 *
 * @param conn - Connector instance for error reporting
 * @param containerId - Container name or ID to inspect
 * @param format - Go template format string for output
 * @param signal - Optional abort signal
 */
async function inspect(
  conn: Connector,
  containerId: string,
  format: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const { exitCode, stdout, stderr } = await processExec(
    ['podman', 'inspect', containerId, '--format', format],
    {
      signal,
    },
  );
  if (exitCode !== 0) {
    throw new ConnectorError(`podman inspect error [${exitCode}]\n${stderr}`, conn);
  }
  return stdout.trim() || null;
}
