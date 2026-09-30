/**
 * Shared virsh plumbing for the libvirt modules.
 *
 * This module is internal (not exported from the package): it builds `virsh`
 * invocations with an optional `--connect` URI and maps "object not found"
 * (virsh exit code 1) to exit code 64, which `sh()` reports without throwing
 * (see `sysopkit/op/sh`), so callers can distinguish absence from failure.
 */

import { $_, sh } from 'sysopkit/op/sh';

/** Common options for virsh operations. */
export interface VirshOptions {
  /**
   * Libvirt connection URI (e.g. `qemu:///system`, `qemu+ssh://host/system`).
   * When omitted, the virsh default connection is used.
   */
  readonly uri?: string;
}

/** Builds a virsh command string with an optional `--connect` URI. */
export function _virsh(uri: string | undefined, rest: string): string {
  const cmd = uri === undefined ? `virsh ${rest}` : `virsh --connect ${$_(uri)} ${rest}`;
  // Pin the C locale: virsh keys and state words are gettext-translated, and
  // every parser in this package expects English output.
  return `LC_ALL=C ${cmd}`;
}

/**
 * Runs a virsh command that prints XML, returning undefined when the object
 * does not exist (virsh exit code 1).
 */
export async function _tryVirshXml(cmd: string): Promise<string | undefined> {
  const { stdout, exitCode } = await sh(`${cmd};o=$?;if [ $o -eq 1 ];then exit 64;else exit $o;fi`);
  if (exitCode === 64) {
    return undefined;
  }
  return stdout;
}

/**
 * `mktemp` template for virsh XML staging files.
 *
 * virsh `...-define` only accepts a path, and stdin cannot be reopened by
 * path on every transport, so XML is staged through `withTempFile()`
 * (`sysopkit/op/temp`) instead of `/dev/stdin`.
 */
export const VIRSH_XML_TEMPLATE = '/tmp/sysopkit-virsh-XXXXXXXX.xml';

/**
 * Parses a virsh `--all` table listing (`list`, `net-list`, `pool-list`).
 *
 * Skips the header and separator lines, returning one trimmed column array
 * per row. The state column of `list` may itself contain spaces
 * (e.g. `shut off`), so callers must join trailing columns as needed.
 */
export function _parseListTable(output: string): string[][] {
  const rows: string[][] = [];
  const lines = output.split('\n');
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      continue;
    }
    rows.push(line.split(/\s+/));
  }
  return rows;
}

/**
 * Parses `virsh {dom,net,pool}info` output into a key-value record.
 *
 * The format is one `Key:  value` pair per line; keys are kept verbatim
 * (`OS Type`, `CPU time`, ...).
 */
export function _parseInfoBlock(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key !== '') {
      result[key] = value;
    }
  }
  return result;
}

/** Size units accepted in virsh info output and domain XML. */
const SIZE_UNIT_TO_MIB: Record<string, number> = {
  B: 1 / 1048576,
  BYTE: 1 / 1048576,
  BYTES: 1 / 1048576,
  KIB: 1 / 1024,
  MIB: 1,
  GIB: 1024,
  TIB: 1024 * 1024,
};

/**
 * Converts a sized value (e.g. `20.00 GiB`, `2097152 KiB`) to MiB.
 *
 * Accepts an optional space between the number and the unit; unit matching
 * is case-insensitive and also accepts bare `K`/`M`/`G`/`T` shorthands.
 */
export function _sizeToMiB(text: string): number {
  const match = /^\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]*)\s*$/.exec(text);
  if (match === null) {
    throw new Error(`invalid size value '${text}'`);
  }
  const amount = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === '') {
    return amount;
  }
  const factor = SIZE_UNIT_TO_MIB[unit] ?? SIZE_UNIT_TO_MIB[`${unit}IB`];
  if (factor === undefined) {
    throw new Error(`unknown size unit in '${text}'`);
  }
  return amount * factor;
}
