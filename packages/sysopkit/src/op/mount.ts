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
}

/** Configuration for mountInfo operation. */
export interface MountInfoOptions {
  readonly path: string;
}

/**
 * Gets mount information for a path using findmnt. Returns null if not mounted.
 */
export async function mountInfo({ path }: MountInfoOptions): Promise<MountInfo | null> {
  const { stdout, exitCode } = await sh(
    `findmnt --json --target ${$_(path)};[ $? -eq 1 ]&&exit 64||exit $?`,
  );
  if (exitCode !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(stdout) as FindmntOutput;
    if (parsed.filesystems && parsed.filesystems.length > 0) {
      const fs = parsed.filesystems[0];
      return {
        target: fs.target,
        source: fs.source,
        fstype: fs.fstype,
        options: fs.options,
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
}

interface FindmntOutput {
  readonly filesystems: FindmntEntry[];
}

/** Configuration for mount operation. */
export interface MountOptions {
  readonly src: string;
  readonly path: string;
  readonly fstype: string;
  readonly opts?: string;
}

/**
 * **[IDEMPOTENT]** Mounts filesystem.
 *
 * @param options - Mount configuration including source, target, fstype.
 */
export async function mount({ src, path, fstype, opts = 'defaults' }: MountOptions): Promise<void> {
  return task(
    `mount ${src} → ${path}`,
    async (ctx) => {
      const currentInfo = await mountInfo({ path });
      if (currentInfo !== null) {
        const srcMatch =
          currentInfo.source === src ||
          currentInfo.source.includes(src) ||
          src.includes(currentInfo.source);

        if (srcMatch && currentInfo.fstype === fstype) {
          const currentOpts = currentInfo.options.split(',')[0] || 'defaults';
          if (opts === 'defaults' || currentOpts === opts.split(',')[0]) {
            return;
          }
        }
      }

      if (!ctx.dryRun) await sh(`mount -t ${$_(fstype)} -o ${$_(opts)} ${$_(src)} ${$_(path)}`);
      emitChanged({ type: 'mount', resource: path, property: 'state', to: 'mounted' });
    },
    { details: () => ({ src, fstype, opts }), verbosity: VERBOSITY_NORMAL },
  );
}

/** Configuration for umount operation. */
export interface UmountOptions {
  readonly path: string;
}

/**
 * **[IDEMPOTENT]** Unmounts filesystem.
 *
 * @param options - Unmount configuration.
 */
export async function umount({ path }: UmountOptions): Promise<void> {
  return task(
    `umount ${path}`,
    async (ctx) => {
      const currentInfo = await mountInfo({ path });
      if (currentInfo === null) {
        return;
      }

      if (!ctx.dryRun) await sh(`umount ${$_(path)}`);
      emitChanged({ type: 'mount', resource: path, property: 'state', to: 'unmounted' });
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}
