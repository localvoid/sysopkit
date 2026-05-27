import { ConnectorBase, type ConnectorOptions } from '../core/connector.js';
import { type Process, processSpawn } from '../utils/process.js';

/**
 * Connector for executing commands on the local machine.
 */
export class LocalConnector extends ConnectorBase {
  constructor(options?: ConnectorOptions) {
    super('', options?.name ?? 'local', options?.vars);
  }

  override get rsh(): string[] {
    return LOCAL_RSH;
  }

  async spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    return processSpawn(cmd, signal);
  }
}

/** Empty array indicating local execution (no remote shell prefix). */
const LOCAL_RSH: string[] = [];
