/**
 * @module mem
 *
 * Memory information gathering operations.
 */

import { sh } from 'sysopkit/op/sh';

/** Memory usage statistics in bytes. */
export interface MemInfo {
  readonly total: number;
  readonly available: number;
  readonly used: number;
  readonly free: number;
}

/**
 * Retrieves current memory usage information.
 *
 * Parses /proc/meminfo and calculates used memory as total minus available.
 * Falls back to free memory if available is not reported.
 */
export async function getMemInfo(): Promise<MemInfo> {
  const { stdout } = await sh('cat /proc/meminfo');

  const memData = _parseMemInfo(stdout);
  const total = memData.MemTotal || 0;
  const available = memData.MemAvailable || memData.MemFree || 0;
  const free = memData.MemFree || 0;

  if (total === 0) {
    throw new Error('failed to parse memory info');
  }

  return {
    total,
    available,
    used: total - available,
    free,
  };
}

function _parseMemInfo(content: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of content.split('\n')) {
    const match = /^(\w+):\s+(\d+)\s+kB$/.exec(line);
    if (match) {
      result[match[1]] = parseInt(match[2], 10) * 1024;
    }
  }
  return result;
}
