/**
 * @module kernel
 *
 * Kernel module management, kexec, and kernel ring buffer operations.
 *
 * @see lsmod(8) - Show the status of modules in the Linux Kernel
 * @see modprobe(8) - Add and remove modules from the Linux Kernel
 * @see modprobe.d(5) - Configuration directory for modprobe
 * @see kexec(8) - Directly reboot into a new kernel
 * @see dmesg(1) - Print or control the kernel ring buffer
 */

import { readFile } from 'sysopkit/op/file';
import { $_, sh } from 'sysopkit/op/sh';

/** A parsed entry from the kernel ring buffer. */
export interface DmesgEntry {
  readonly facility: string;
  readonly level: string;
  readonly timestamp: number;
  readonly message: string;
}

/** Filter options for dmesg output. */
export interface DmesgOptions {
  readonly level?: string | string[];
  readonly facility?: string | string[];
  readonly since?: string;
  readonly until?: string;
}

/**
 * Retrieves kernel ring buffer messages using dmesg.
 *
 * Parses JSON output when available, falls back to plain text lines.
 */
export async function dmesg(options?: DmesgOptions): Promise<DmesgEntry[]> {
  const { level, facility, since, until } = options ?? {};

  let cmd = `dmesg --json`;
  if (level) {
    const levels = Array.isArray(level) ? level.join(',') : level;
    cmd += ` -l ${$_(levels)}`;
  }
  if (facility) {
    const facilities = Array.isArray(facility) ? facility.join(',') : facility;
    cmd += ` -f ${$_(facilities)}`;
  }
  if (since) cmd += `--since ${$_(since)}`;
  if (until) cmd += `--until ${$_(until)}`;

  const { stdout } = await sh(cmd);

  try {
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry: Record<string, string | number>) => ({
      facility: String(entry.facility ?? ''),
      level: String(entry.level ?? entry.priority ?? ''),
      timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : 0,
      message: String(entry.message ?? entry.msg ?? ''),
    }));
  } catch {
    const lines = stdout.trim().split('\n');
    const entries: DmesgEntry[] = [];

    for (const line of lines) {
      if (line.trim()) {
        entries.push({
          facility: 'kern',
          level: 'info',
          timestamp: 0,
          message: line,
        });
      }
    }

    return entries;
  }
}

export const MODPROBE_D = '/etc/modprobe.d';

/** A loaded kernel module entry from /proc/modules. */
export interface LsmodEntry {
  readonly module: string;
  readonly size: number;
  readonly usedBy: string[];
  readonly count: number;
}

/**
 * Lists currently loaded kernel modules.
 *
 * Parses /proc/modules directly instead of invoking lsmod for better performance.
 */
export async function lsmod(): Promise<LsmodEntry[]> {
  const raw = await readFile('/proc/modules');
  const lines = raw
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  const entries: LsmodEntry[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const module = parts[0];
      const size = parseInt(parts[1], 10);
      const count = parseInt(parts[2], 10);
      const usedBy = parts.length > 3 ? parts[3].split(',').filter((s) => s && s !== '-') : [];

      entries.push({ module, size, usedBy, count });
    }
  }

  return entries;
}

/** Detailed information about a kernel module. */
export interface ModprobeInfo {
  readonly filename: string;
  readonly license: string;
  readonly description: string;
  readonly author: string;
  readonly alias: string[];
  readonly depends: string[];
  readonly parm: Record<string, string>;
}

/**
 * Retrieves detailed information about a kernel module.
 *
 * Uses modprobe to query module metadata including license, dependencies,
 * and parameters.
 */
export async function modinfo(module: string): Promise<ModprobeInfo> {
  const fields = ['filename', 'license', 'description', 'author', 'alias', 'depends', 'parm'];
  const results: Record<string, string> = {};

  for (const field of fields) {
    const { stdout } = await sh(`modinfo -F ${$_(field)} ${$_(module)}`);
    results[field] = stdout.trim();
  }

  const alias = results.alias
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s);
  const depends = results.depends
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s);
  const parm: Record<string, string> = {};

  for (const line of results.parm.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const name = trimmed.slice(0, colonIdx).trim();
      const desc = trimmed.slice(colonIdx + 1).trim();
      parm[name] = desc;
    }
  }

  return {
    filename: results.filename,
    license: results.license,
    description: results.description,
    author: results.author,
    alias,
    depends,
    parm,
  };
}

/** Options for loading a kernel with kexec. */
export interface KexecLoadOptions {
  readonly kernel: string;
  readonly initrd?: string;
  readonly cmdline?: string;
}

/**
 * Loads a kernel into memory using kexec.
 *
 * The kernel is loaded but not executed. Call `kexecExec()` to boot into it.
 */
export async function kexecLoad(options: KexecLoadOptions): Promise<void> {
  const { kernel, initrd, cmdline } = options;
  let cmd = `kexec -l ${$_(kernel)}`;
  if (initrd) cmd += ` ${$_(`--initrd=${initrd}`)}`;
  if (cmdline) cmd += ` ${$_(`--append=${cmdline}`)}`;
  await sh(cmd);
}

/**
 * Executes the loaded kernel, rebooting the system immediately.
 *
 * Requires a kernel to be loaded via `kexecLoad()` first.
 */
export async function kexecExec(): Promise<void> {
  await sh('kexec -e');
}
