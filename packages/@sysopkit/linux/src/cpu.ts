/**
 * @module cpu
 *
 * CPU information gathering operations.
 *
 * @see lscpu(1) - display information about the CPU architecture
 */

import { sh } from 'sysopkit/op/sh';

/** CPU architecture and topology information. */
export interface CpuInfo {
  readonly cores: number;
  readonly modelName: string;
  readonly architecture: string;
  readonly vendor: string;
  readonly sockets: number;
  readonly coresPerSocket: number;
  readonly threadsPerCore: number;
}

/**
 * Retrieves CPU information using lscpu.
 *
 * Parses JSON output to extract architecture, topology, and model details.
 */
export async function lscpu(): Promise<CpuInfo> {
  const { stdout } = await sh('lscpu --json');

  let json: LscpuOutput;
  try {
    json = JSON.parse(stdout) as LscpuOutput;
  } catch {
    throw new Error('failed to parse lscpu output');
  }

  if (!json.lscpu) {
    throw new Error('invalid lscpu output');
  }

  const data = new Map<string, string>();
  for (const entry of json.lscpu) {
    const key = entry.field.replace(/:$/, '').trim();
    data.set(key, entry.data.trim());
  }

  return {
    cores: parseInt(data.get('CPU(s)') || '0', 10),
    modelName: data.get('Model name') || '',
    architecture: data.get('Architecture') || '',
    vendor: data.get('Vendor ID') || '',
    sockets: parseInt(data.get('Socket(s)') || '1', 10),
    coresPerSocket: parseInt(data.get('Core(s) per socket') || '1', 10),
    threadsPerCore: parseInt(data.get('Thread(s) per core') || '1', 10),
  };
}

interface LscpuEntry {
  readonly field: string;
  readonly data: string;
}

interface LscpuOutput {
  readonly lscpu: LscpuEntry[];
}
