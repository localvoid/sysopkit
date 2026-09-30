/**
 * @module op/mount
 *
 * Mount and fstab management operations.
 *
 * @see mount(8) - mount a filesystem
 * @see umount(8) - unmount filesystems
 * @see findmnt(8) - find a filesystem
 */

import { emitChanged, task } from '../core/context.js';
import { VERBOSITY_NORMAL } from '../core/reporter.js';
import { $_, sh } from './sh.js';

/** Path to the fstab configuration file. */
export const FSTAB_PATH = '/etc/fstab';

/**
 * Represents a single entry in an fstab file.
 */
export interface FstabEntry {
  /** The device identifier (e.g., UUID=xxxx, /dev/sda1, /dev/disk/by-label/...). */
  readonly device: string;
  /** The mount point (e.g., /, /mnt/data, swap). */
  readonly mountPoint: string;
  /** The filesystem type (e.g., ext4, ntfs, swap, auto). */
  readonly fsType: string;
  /** Mount options (e.g., defaults, noatime). */
  readonly options: string[];
  /** Dump frequency (usually 0). */
  readonly dump: number;
  /** Pass number for fsck (usually 0, 1, or 2). */
  readonly pass: number;
}

/** Configuration for fstab serialization. */
export interface FstabSerializerOptions {
  /** Align columns for readability. Defaults to true. */
  readonly alignColumns?: boolean;
  /** Whitespace character for separation if aligning. Defaults to space. */
  readonly separatorChar?: string;
}

/**
 * Escapes special characters in fstab fields using octal sequences.
 *
 * Spaces become `\040`, tabs become `\011`, etc.
 */
function escapeFstabField(text: string): string {
  return text.replace(/\s/g, (match) => {
    switch (match) {
      case ' ':
        return '\\040';
      case '\t':
        return '\\011';
      case '\n':
        return '\\012';
      case '\\':
        return '\\134';
      default:
        return `\\${match.charCodeAt(0).toString(8).padStart(3, '0')}`;
    }
  });
}

/**
 * Serializes a single FstabEntry to a formatted string line.
 *
 * @param entry - The fstab entry to serialize
 * @param columnWidths - Optional column widths for alignment padding
 * @returns Formatted fstab line
 */
function _serializeEntry(entry: FstabEntry, columnWidths?: number[]): string {
  const fields: string[] = [
    escapeFstabField(entry.device),
    escapeFstabField(entry.mountPoint),
    escapeFstabField(entry.fsType),
    escapeFstabField(entry.options.join(',')),
    String(entry.dump),
    String(entry.pass),
  ];

  if (columnWidths) {
    const paddedFields = fields.map((field, index) => {
      return field.padEnd(columnWidths[index]);
    });
    return paddedFields.join('\t');
  }

  return fields.join('\t');
}

/**
 * Serializes an array of FstabEntry objects into fstab file content.
 *
 * @param entries - Array of fstab entries to serialize
 * @param options - Serialization options including column alignment
 * @returns Complete fstab file content string
 */
export function serializeFstab(entries: FstabEntry[], options?: FstabSerializerOptions): string {
  const alignColumns = options?.alignColumns ?? true;

  let columnWidths: undefined | number[];
  if (alignColumns) {
    columnWidths = [0, 0, 0, 0, 0, 0];

    for (const entry of entries) {
      const lengths = [
        entry.device.length,
        entry.mountPoint.length,
        entry.fsType.length,
        entry.options.join(',').length,
        String(entry.dump).length,
        String(entry.pass).length,
      ];

      for (let i = 0; i < lengths.length; i++) {
        const len = lengths[i];
        if (len > columnWidths[i]) {
          columnWidths[i] = len;
        }
      }
    }
  }

  let s = '';
  for (const entry of entries) {
    s += _serializeEntry(entry, columnWidths) + '\n';
  }
  return s;
}

const RE_FIELD = /(?:(?:[^\\\s]|\\.)+)+|\S+/g;
const RE_ESCAPE = /\\([0-7]{3})/g;

/** Unescapes octal sequences in fstab fields back to their original characters. */
function _unescapeFstabField(text: string): string {
  return text.replace(RE_ESCAPE, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Parses fstab file content into an array of FstabEntry objects.
 *
 * Skips blank lines and comments. Handles escaped characters in fields.
 *
 * @param content - Raw fstab file content
 * @returns Array of parsed fstab entries
 */
export function parseFstab(content: string): FstabEntry[] {
  const entries: FstabEntry[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    const s = line.trim();
    if (s === '' || s.startsWith('#')) {
      continue;
    }

    const fields = s.match(RE_FIELD);
    if (fields !== null && fields.length >= 6) {
      entries.push({
        device: _unescapeFstabField(fields[0]),
        mountPoint: _unescapeFstabField(fields[1]),
        fsType: _unescapeFstabField(fields[2]),
        options: _unescapeFstabField(fields[3]).split(','),
        dump: parseInt(fields[4], 10),
        pass: parseInt(fields[5], 10),
      });
    }
  }

  return entries;
}

/** Mount information from findmnt. */
export interface MountInfo {
  readonly target: string;
  readonly source: string;
  readonly fstype: string;
  readonly options: string;
  /**
   * Propagation state from the `PROPAGATION` column (e.g. `shared`,
   * `private,slave`). Absent on older util-linux without the column.
   */
  readonly propagation?: string;
}

/** Configuration for mountInfo operation. */
export interface MountInfoOptions {
  readonly path: string;
}

/**
 * Gets mount information for a path using findmnt. Returns null if not mounted.
 *
 * The `PROPAGATION` column is requested explicitly: it is absent from the
 * default JSON output on some util-linux releases (e.g. 2.40).
 * `findmnt --target` reports the containing filesystem for existing paths
 * that are not mount points themselves, so the result is only returned when
 * the reported target matches the requested path exactly.
 */
export async function mountInfo({ path }: MountInfoOptions): Promise<MountInfo | null> {
  const { stdout, exitCode } = await sh(
    `findmnt --json -o TARGET,SOURCE,FSTYPE,OPTIONS,PROPAGATION --target ${$_(path)};o=$?;if [ $o -eq 1 ];then exit 64;else exit $o;fi`,
  );
  if (exitCode !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(stdout) as FindmntOutput;
    if (parsed.filesystems && parsed.filesystems.length > 0) {
      const fs = parsed.filesystems[0];
      if (fs.target !== path) {
        return null;
      }
      return {
        target: fs.target,
        source: fs.source,
        fstype: fs.fstype,
        options: fs.options,
        ...(fs.propagation !== undefined ? { propagation: fs.propagation } : {}),
      };
    }
  } catch {}
  return null;
}

interface FindmntEntry {
  readonly target: string;
  readonly source: string;
  readonly fstype: string;
  readonly options: string;
  readonly propagation?: string;
}

interface FindmntOutput {
  readonly filesystems: FindmntEntry[];
}

/**
 * Mount propagation type for `--make-*` flags.
 *
 * @see mount(8) - propagation flags
 */
export type MountPropagation =
  | 'shared'
  | 'rshared'
  | 'slave'
  | 'rslave'
  | 'private'
  | 'rprivate'
  | 'unbindable'
  | 'runbindable';

/** Configuration for mount operation. */
export interface MountOptions {
  /**
   * Mount source (device, `tmpfs`, or bind source directory/file).
   * Optional only for a propagation-only remount
   * (`mount --make-<mode> <path>`); required otherwise.
   */
  readonly src?: string;
  readonly path: string;
  /**
   * Filesystem type (e.g. `ext4`, `tmpfs`). Required unless this is a
   * bind mount — `mount --bind` takes no type.
   */
  readonly fstype?: string;
  /** Mount options for `-o` (regular mounts only). Defaults to `defaults`. */
  readonly opts?: string;
  /**
   * Bind-mount `src` onto `path` (`mount --bind`) instead of mounting
   * a filesystem by type. Default false.
   */
  readonly bind?: boolean;
  /**
   * Add `--make-rslave` to a bind mount, so mounts under the source
   * don't propagate into the bind (container/installer API mounts
   * such as `/dev`). Implies `bind`. Prefer `propagation: 'rslave'`.
   * Default false.
   */
  readonly rslave?: boolean;
  /**
   * Recursive bind-mount (`mount --rbind`) so submounts under `src`
   * (e.g. `/dev/pts`, `/dev/shm`) propagate into the bind. Implies
   * `bind`. Combines with `propagation` as
   * `mount --make-rslave --rbind <src> <path>`. Default false.
   */
  readonly rbind?: boolean;
  /**
   * Create missing mountpoint parents (`mount --mkdir`,
   * util-linux ≥ 2.30). Applies to bind and regular mounts, not to
   * propagation-only remounts. Default false.
   */
  readonly mkdir?: boolean;
  /**
   * Mount onto the path itself instead of the resolved target
   * (`mount --no-canonicalize`), e.g. a `resolv.conf` file bind over
   * a stub symlink. Bind mounts only. Default false.
   */
  readonly noCanonicalize?: boolean;
  /**
   * Change propagation (`mount --make-<mode>`) either fused with a
   * mount (`mount --make-rslave --rbind <src> <path>`) or standalone
   * without `src` (`mount --make-rslave <path>`). Default unset.
   */
  readonly propagation?: MountPropagation;
}

/**
 * Whether a `findmnt` propagation value already satisfies the requested
 * `--make-*` mode. Recursive (`r-`) and non-recursive spellings are
 * treated as equivalent (`rslave` matches `slave`, including combined
 * values such as `private,slave`); an unknown (absent column) never
 * matches so the remount still runs.
 */
function propagationSatisfied(requested: MountPropagation, current: string | undefined): boolean {
  if (current === undefined) {
    return false;
  }
  const base = requested.startsWith('r') ? requested.slice(1) : requested;
  return current
    .split(',')
    .map((s) => s.trim())
    .includes(base);
}

/**
 * **[IDEMPOTENT]** Mounts filesystem.
 *
 * Regular mounts emit `mount [--mkdir] [--make-<mode>] -t <fstype> -o <opts> <src> <path>`;
 * bind mounts emit `mount [--mkdir] [--no-canonicalize] [--make-<mode>] --bind|--rbind <src> <path>`;
 * propagation-only remounts emit `mount --make-<mode> <path>`.
 * Skips when `path` already exposes `src` (binds compare file identity
 * via `stat`, since findmnt reports the backing device rather than the
 * source path; regular mounts compare source, fstype and options;
 * propagation-only remounts compare the `PROPAGATION` column).
 *
 * Bind idempotency compares only file identity: switching `bind` to
 * `rbind` (or changing propagation) on an already-bound path is not
 * detected — detach with `umount({ recursive: true })` first.
 */
export async function mount(o: MountOptions): Promise<void> {
  const { src, path } = o;
  const rbind = o.rbind === true;
  const mkdir = o.mkdir === true;
  const noCanonicalize = o.noCanonicalize === true;
  const fstype = o.fstype;
  const opts = o.opts ?? 'defaults';
  // Resolved without throwing so the task name is always available;
  // conflicts are refused inside the task body (a throw outside task()
  // would miss the task frame in the reported context stack).
  const propagation: MountPropagation | undefined =
    o.propagation ?? (o.rslave === true ? 'rslave' : undefined);
  const name =
    src === undefined
      ? propagation !== undefined
        ? `mount --make-${propagation} ${path}`
        : `mount ${path}`
      : `mount ${src} → ${path}`;
  return task(
    name,
    async (ctx) => {
      if (o.rslave === true && o.propagation !== undefined && o.propagation !== 'rslave') {
        throw new Error(`refusing: rslave conflicts with propagation '${o.propagation}'`);
      }

      if (src === undefined) {
        if (propagation === undefined) {
          throw new Error('refusing: src is required unless propagation is set');
        }
        if (
          o.bind === true ||
          rbind ||
          fstype !== undefined ||
          o.opts !== undefined ||
          noCanonicalize ||
          mkdir
        ) {
          throw new Error('refusing: propagation-only remount takes no src, bind, fstype, or mkdir');
        }
        const currentInfo = await mountInfo({ path });
        if (currentInfo !== null && propagationSatisfied(propagation, currentInfo.propagation)) {
          return;
        }
        if (!ctx.dryRun) {
          await sh(`mount --make-${propagation} ${$_(path)}`);
        }
        emitChanged({ type: 'mount', resource: path, property: 'state', to: 'mounted' });
        return;
      }

      const bind = o.bind === true || o.rslave === true || rbind;
      if (!bind && fstype === undefined) {
        throw new Error('refusing: fstype is required unless bind is set');
      }
      if (noCanonicalize && !bind) {
        throw new Error('refusing: noCanonicalize requires bind');
      }
      const mkdirFlag = mkdir ? ' --mkdir' : '';
      const noCanonicalizeFlag = noCanonicalize ? ' --no-canonicalize' : '';
      const propagationFlag = propagation !== undefined ? ` --make-${propagation}` : '';
      const bindKind = rbind ? '--rbind' : '--bind';
      const currentInfo = await mountInfo({ path });
      if (currentInfo !== null) {
        const srcMatch =
          currentInfo.source === src ||
          currentInfo.source.includes(src) ||
          src.includes(currentInfo.source);

        if (bind) {
          // findmnt reports the backing device for binds (e.g. `udev`
          // for a `/dev` bind), never the source path — compare file
          // identity instead: a bound path exposes the source's inode.
          // This holds for --rbind and --no-canonicalize as well (both
          // ends resolve to the same inode either way).
          const { stdout: ids } = await sh(
            `stat -c '%d %i' ${$_(src)}; stat -c '%d %i' ${$_(path)}`,
          );
          const [srcId, pathId] = ids.trim().split('\n');
          if (srcId !== undefined && srcId !== '' && srcId === pathId) {
            return;
          }
        } else if (srcMatch && currentInfo.fstype === fstype) {
          const currentOpts = currentInfo.options.split(',')[0] || 'defaults';
          if (opts === 'defaults' || currentOpts === opts.split(',')[0]) {
            return;
          }
        }
      }

      if (!ctx.dryRun) {
        if (bind) {
          await sh(
            `mount${mkdirFlag}${noCanonicalizeFlag}${propagationFlag} ${bindKind} ${$_(src)} ${$_(path)}`,
          );
        } else {
          await sh(
            `mount${mkdirFlag}${propagationFlag} -t ${$_(fstype as string)} -o ${$_(opts)} ${$_(src)} ${$_(path)}`,
          );
        }
      }
      emitChanged({ type: 'mount', resource: path, property: 'state', to: 'mounted' });
    },
    {
      details: () =>
        src === undefined
          ? { path, propagation }
          : {
              src,
              fstype,
              opts,
              ...(rbind ? { rbind: 'true' } : {}),
              ...(mkdir ? { mkdir: 'true' } : {}),
              ...(noCanonicalize ? { noCanonicalize: 'true' } : {}),
              propagation,
            },
      verbosity: VERBOSITY_NORMAL,
    },
  );
}

/** Configuration for umount operation. */
export interface UmountOptions {
  readonly path: string;
  /**
   * Detach the whole tree under `path` (`umount -R`), not just the
   * mount at `path` itself. The pre-check is submount-aware, so
   * orphaned child mounts are detached even when `path` itself is
   * no longer mounted. Default false.
   */
  readonly recursive?: boolean;
  /** Lazy detach (`umount -l`). Default false. */
  readonly lazy?: boolean;
  /**
   * Never throw: the detach runs with `2>/dev/null || true`. For
   * cleanup / pre-reboot paths that must not strand the flow when
   * the detach fails. Default false (failures are loud).
   */
  readonly ignoreErrors?: boolean;
}

interface SubmountNode {
  readonly target: string;
  readonly children?: SubmountNode[];
}

/**
 * All mount targets at or under `path` (itself included when
 * mounted), or null when `path` resolves to no filesystem.
 */
async function submountTargets(path: string): Promise<string[] | null> {
  const { stdout, exitCode } = await sh(
    `findmnt -R --json --target ${$_(path)};o=$?;if [ $o -eq 1 ];then exit 64;else exit $o;fi`,
  );
  if (exitCode !== 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(stdout) as { filesystems?: SubmountNode[] };
    const targets: string[] = [];
    const walk = (nodes: SubmountNode[] | undefined): void => {
      for (const node of nodes ?? []) {
        targets.push(node.target);
        walk(node.children);
      }
    };
    walk(parsed.filesystems);
    return targets;
  } catch {
    return null;
  }
}

/**
 * **[IDEMPOTENT]** Unmounts filesystem.
 *
 * Plain `umount <path>` skips when `path` is not mounted;
 * `recursive` detaches the whole tree when anything is mounted at
 * or under `path`. `ignoreErrors` turns a failed detach into a no-op
 * for cleanup / pre-reboot paths.
 */
export async function umount(o: UmountOptions): Promise<void> {
  const { path } = o;
  const recursive = o.recursive === true;
  const lazy = o.lazy === true;
  const ignoreErrors = o.ignoreErrors === true;
  const lazyFlag = lazy ? ' -l' : '';
  const flags = `${lazyFlag}${recursive ? ' -R' : ''}`;
  const suffix = ignoreErrors ? ' 2>/dev/null || true' : '';
  return task(
    `umount${flags} ${path}`,
    async (ctx) => {
      // Relevant targets for a recursive detach, deepest first. Null when
      // nothing is mounted at or under `path`.
      let orphanTargets: string[] | null = null;
      if (recursive) {
        const targets = await submountTargets(path);
        const relevant = (targets ?? []).filter((t) => t === path || t.startsWith(`${path}/`));
        if (relevant.length === 0) {
          return;
        }
        if (!relevant.includes(path)) {
          // `umount -R <path>` requires `path` itself to be mounted
          // (live: "not mounted" while a child stays attached), so detach
          // orphaned children directly, deepest first.
          relevant.sort((a, b) => b.split('/').length - a.split('/').length || b.length - a.length);
          orphanTargets = relevant;
        }
      } else {
        const currentInfo = await mountInfo({ path });
        if (currentInfo === null) {
          return;
        }
      }

      if (!ctx.dryRun) {
        if (orphanTargets !== null) {
          for (const t of orphanTargets) {
            await sh(`umount${lazyFlag} ${$_(t)}${suffix}`);
          }
        } else {
          await sh(`umount${flags} ${$_(path)}${suffix}`);
        }
      }
      emitChanged({ type: 'mount', resource: path, property: 'state', to: 'unmounted' });
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}
