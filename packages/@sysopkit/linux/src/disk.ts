/**
 * @module disk
 *
 * Disk information gathering operations.
 *
 * @see lsblk(8) - list block devices
 */

import { sh } from 'sysopkit/op/sh';

/** A block device entry from lsblk output. */
export interface BlockDeviceEntry {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly mountpoint?: string;
  readonly fstype?: string;
  readonly children?: BlockDeviceEntry[];
}

/**
 * Retrieves block device information using lsblk.
 *
 * Returns a tree of block devices with their properties including size, type,
 * mount points, and filesystem types.
 */
export async function lsblk(): Promise<BlockDeviceEntry[]> {
  const { stdout } = await sh('lsblk --json -b -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE');

  let json: LsblkOutput;
  try {
    json = JSON.parse(stdout) as LsblkOutput;
  } catch {
    throw new Error('failed to parse lsblk output');
  }
  if (!json.blockdevices) {
    throw new Error('invalid lsblk output');
  }

  return json.blockdevices.map(_device);
}

function _device(dev: LsblkDevice): BlockDeviceEntry {
  return {
    name: dev.name,
    size: dev.size,
    type: dev.type,
    mountpoint: dev.mountpoint ?? void 0,
    fstype: dev.fstype ?? void 0,
    children: dev.children?.map(_device),
  };
}

interface LsblkDevice {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly mountpoint?: string | null;
  readonly fstype?: string | null;
  readonly children?: LsblkDevice[];
}

interface LsblkOutput {
  readonly blockdevices: LsblkDevice[];
}
