/**
 * @module os
 *
 * Operating system information gathering operations.
 *
 * @see uname(1) - print system information
 * @see os-release(5) - operating system identification
 */

import { readFile } from 'sysopkit/op/file';
import { parseShellConf } from 'sysopkit/op/sh';

/** Operating system identification and kernel information. */
export interface OSInfo {
  readonly name: string;
  readonly version: string;
  readonly id: string;
  readonly versionId: string;
}

/**
 * Retrieves operating system information.
 *
 * Combines uname output with /etc/os-release parsing to provide a unified
 * view of system identity.
 */
export async function getOSInfo(): Promise<OSInfo> {
  const content = await readFile('/etc/os-release');
  const data = parseShellConf(content);

  return {
    name: data['NAME'],
    version: data['VERSION'],
    id: data['ID'],
    versionId: data['VERSION_ID'],
  } satisfies OSInfo;
}
