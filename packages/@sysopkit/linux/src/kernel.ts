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

import { task, VERBOSITY_NORMAL } from 'sysopkit';
import { readFile, tryReadFile } from 'sysopkit/op/file';
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

/** Which kexec syscall to use when loading a kernel. */
export type KexecSyscall =
  /** Try `KEXEC_FILE_LOAD` first, fall back to `KEXEC_LOAD` (`kexec -a`). */
  | 'auto'
  /** Use `KEXEC_FILE_LOAD` exclusively (`kexec -s`). */
  | 'file'
  /** Use `KEXEC_LOAD` exclusively (`kexec -c`). */
  | 'load';

/** Options for loading a kernel with kexec. */
export interface KexecLoadOptions {
  readonly kernel: string;
  readonly initrd?: string;
  readonly cmdline?: string;
  /**
   * Which kexec syscall to use.
   *
   * Use `'file'` on systems with locked-down Secure Boot: `KEXEC_LOAD`
   * is blocked there and `KEXEC_FILE_LOAD` (`kexec -s`) is required so
   * the kernel signature is verified. Use `'load'` for kernel images
   * or architectures without `KEXEC_FILE_LOAD` support. Omit for the
   * kexec default (auto).
   */
  readonly syscall?: KexecSyscall;
}

/**
 * Loads a kernel into memory using kexec.
 *
 * The kernel is loaded but not executed. Call `kexecExec()` to boot into it.
 */
export async function kexecLoad(options: KexecLoadOptions): Promise<void> {
  // Resolved without throwing so the task name is always available;
  // conflicts are refused inside the task body (a throw outside task()
  // would miss the task frame in the reported context stack).
  const raw = options as KexecLoadOptions | undefined;
  const kernelName = typeof raw?.kernel === 'string' ? raw.kernel : '';
  return task(
    kernelName !== '' ? `kexec -l ${kernelName}` : 'kexec -l',
    async (ctx) => {
      const { kernel, initrd, cmdline, syscall }: KexecLoadOptions =
        raw ?? ({} as KexecLoadOptions);
      if (typeof kernel !== 'string' || kernel === '') {
        throw new Error('refusing: kernel is required');
      }
      if (initrd !== undefined && (typeof initrd !== 'string' || initrd === '')) {
        throw new Error('refusing: invalid initrd');
      }
      if (cmdline !== undefined && typeof cmdline !== 'string') {
        throw new Error('refusing: invalid cmdline');
      }
      if (syscall !== undefined && syscall !== 'auto' && syscall !== 'file' && syscall !== 'load') {
        throw new Error(`refusing: invalid syscall '${String(syscall)}'`);
      }
      let cmd = 'kexec';
      if (syscall === 'file') cmd += ' -s';
      else if (syscall === 'load') cmd += ' -c';
      else if (syscall === 'auto') cmd += ' -a';
      cmd += ` -l ${$_(kernel)}`;
      if (initrd) cmd += ` ${$_(`--initrd=${initrd}`)}`;
      if (cmdline) cmd += ` ${$_(`--append=${cmdline}`)}`;
      if (!ctx.dryRun) await sh(cmd);
    },
    {
      details: () => ({
        kernel: kernelName,
        ...(typeof raw?.initrd === 'string' ? { initrd: raw.initrd } : {}),
        ...(typeof raw?.cmdline === 'string' ? { cmdline: raw.cmdline } : {}),
        ...(typeof raw?.syscall === 'string' ? { syscall: raw.syscall } : {}),
      }),
      verbosity: VERBOSITY_NORMAL,
    },
  );
}

/** Sysfs flag reporting whether a kernel is loaded for kexec (`1` = loaded). */
export const KEXEC_LOADED_PATH = '/sys/kernel/kexec_loaded';

/** Options for executing a kexec-loaded kernel. */
export interface KexecExecOptions {
  /**
   * Initiate the jump and return once handed off (success = jump
   * initiated, unobservable by design). Detaches stdin/stdout/stderr
   * so the calling SSH session can close first.
   *
   * Foreground mode (`false`) runs `kexec -e` in the foreground: the
   * jump severs the transport, so success surfaces as a transport error,
   * indistinguishable from genuine failure.
   *
   * Default: `true`.
   */
  readonly detach?: boolean;
  /**
   * Remote-side delay in seconds before exec so the calling session
   * closes first. Only meaningful with `detach`.
   *
   * Default: `3`.
   */
  readonly delaySec?: number;
  /**
   * Skip the `/sys/kernel/kexec_loaded` precondition check.
   *
   * Default: `false`.
   */
  readonly skipLoadedCheck?: boolean;
}

/**
 * Builds the remote `kexec -e` shell command.
 *
 * Detached commands background the exec with stdin/stdout/stderr
 * detached so sshd doesn't linger on open file descriptors.
 */
export function _kexecExecCmd(detach: boolean, delaySec: number): string {
  if (!detach) return 'kexec -e';
  const body = delaySec > 0 ? `(sleep ${delaySec}; kexec -e)` : 'kexec -e';
  return `${body} </dev/null >/dev/null 2>&1 &`;
}

/**
 * Executes the loaded kernel, rebooting the system immediately.
 *
 * Requires a kernel to be loaded via `kexecLoad()` first (checked via
 * `/sys/kernel/kexec_loaded` unless `skipLoadedCheck` is set).
 *
 * Detached mode (default) remote-backgrounds the exec and returns on
 * handoff: the jump severs the transport by design, so success is
 * unobservable — verify via out-of-band state (e.g. wait for the new
 * kernel's `/proc/cmdline`), never via this call's result.
 */
export async function kexecExec(options?: KexecExecOptions): Promise<void> {
  // Resolved without throwing so the task name is always available;
  // conflicts are refused inside the task body (a throw outside task()
  // would miss the task frame in the reported context stack).
  const detached = options?.detach ?? true;
  return task(
    detached === false ? 'kexec -e' : 'kexec -e (detached)',
    async (ctx) => {
      const detach = options?.detach ?? true;
      const delaySec = options?.delaySec ?? 3;
      const skipLoadedCheck = options?.skipLoadedCheck ?? false;
      if (typeof detach !== 'boolean') {
        throw new Error(`refusing: invalid detach '${String(detach)}'`);
      }
      if (typeof delaySec !== 'number' || !Number.isFinite(delaySec) || delaySec < 0) {
        throw new Error(`refusing: invalid delaySec '${String(delaySec)}'`);
      }
      if (detach === false && options?.delaySec !== undefined) {
        throw new Error('refusing: delaySec requires detach');
      }
      if (typeof skipLoadedCheck !== 'boolean') {
        throw new Error(`refusing: invalid skipLoadedCheck '${String(skipLoadedCheck)}'`);
      }
      if (!ctx.dryRun && !skipLoadedCheck) {
        const loaded = await tryReadFile(KEXEC_LOADED_PATH);
        if (loaded?.trim() !== '1') {
          throw new Error('kexec: no kernel loaded (run kexecLoad() first)');
        }
      }
      if (!ctx.dryRun) await sh(_kexecExecCmd(detach, delaySec));
    },
    {
      details: () => ({
        detach: String(options?.detach ?? true),
        delaySec: String(options?.delaySec ?? 3),
        ...(options?.skipLoadedCheck !== undefined
          ? { skipLoadedCheck: String(options.skipLoadedCheck) }
          : {}),
      }),
      verbosity: VERBOSITY_NORMAL,
    },
  );
}
