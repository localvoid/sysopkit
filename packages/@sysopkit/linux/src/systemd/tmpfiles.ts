/**
 * @module systemd/tmpfiles
 *
 * systemd-tmpfiles configuration management.
 *
 * @see tmpfiles.d(5) - Configuration for creation, deletion, and cleaning of files
 *
 * Configuration is written to: /etc/tmpfiles.d/{name}.conf
 *
 * tmpfiles.d is used to create volatile files/directories at boot and
 * perform periodic cleanup based on age.
 */

export type TmpFilesConf = TmpFilesEntry[];

/**
 * tmpfiles.d line types.
 *
 * Each type is a single letter that determines the action:
 * - f/f+: Create/write file (f+ truncates existing)
 * - w/w+: Write to existing file (w+ appends)
 * - d/D: Create directory (D also removes on --remove)
 * - e: Clean existing directory contents
 * - v/q/Q: Create btrfs subvolume (with quota handling)
 * - p/p+: Create FIFO/pipe
 * - L/L+/L?: Create symlink (L+ replaces existing, L? skips if source missing)
 * - c/c+/b/b+: Create device node
 * - C/C+: Copy files/directories
 * - x/X: Ignore during cleaning (X doesn't ignore contents)
 * - r/R: Remove path (R recursive)
 * - z/Z: Adjust mode/ownership (Z recursive)
 * - t/T: Set extended attributes (T recursive)
 * - h/H: Set file attributes (H recursive)
 * - a/a+/A/A+: Set POSIX ACLs (recursive with A/A+)
 *
 * Type modifiers may be appended to the base type (e.g., `d!`, `r!`, `f-`,
 * `d=`, `f~`, `f^`, `d$`, and combinations). The `type` field accepts any
 * such combination; the union lists base types for autocomplete.
 *
 * @see tmpfiles.d(5) for complete documentation
 */
export type TmpfilesType =
  | 'f'
  | 'f+'
  | 'w'
  | 'w+'
  | 'd'
  | 'D'
  | 'e'
  | 'v'
  | 'q'
  | 'Q'
  | 'p'
  | 'p+'
  | 'L'
  | 'L+'
  | 'L?'
  | 'c'
  | 'c+'
  | 'b'
  | 'b+'
  | 'C'
  | 'C+'
  | 'x'
  | 'X'
  | 'r'
  | 'R'
  | 'z'
  | 'Z'
  | 't'
  | 'T'
  | 'h'
  | 'H'
  | 'a'
  | 'a+'
  | 'A'
  | 'A+';

/**
 * A tmpfiles configuration entry.
 */
export type TmpFilesEntry = {
  /**
   * Line type determining the action to perform.
   * @see TmpfilesType for available types
   */
  type: TmpfilesType;

  /**
   * Absolute path for the file/directory to create or manage.
   * Supports specifier expansion (e.g., %h for home directory).
   */
  path: string;

  /**
   * File access mode (octal, e.g., "0755" or 0o755).
   * Use "-" for default (0755 for dirs, 0644 for files).
   * Prefix with "~" to mask based on existing permissions,
   * or ":" to apply only when creating new inodes.
   */
  mode?: string | number;

  /**
   * User name or UID. Use "-" for current user.
   * Prefix with ":" to apply only when creating new inodes.
   */
  user?: string;

  /**
   * Group name or GID. Use "-" for current group.
   * Prefix with ":" to apply only when creating new inodes.
   */
  group?: string;

  /**
   * Age for time-based cleanup (e.g., "10d", "1w", "30s", "1h 30min").
   * Supports "~" one-level form and "age-by:" selectors (e.g., "bmA:1h").
   * Files older than this are deleted during --clean.
   * Use "0" for unconditional cleanup.
   * Use "-" to disable cleanup.
   */
  age?: string;

  /**
   * Argument field contents. Meaning depends on type:
   * - f/w: Content to write to file
   * - L: Symlink target path (omitted defaults to /usr/share/factory/)
   * - c/b: Device major:minor (e.g., "1:3")
   * - C: Source path to copy from (omitted defaults to factory)
   * - t/T: Extended attributes (namespace.attr=value)
   * - a/A: POSIX ACLs
   * - h/H: File attributes (+/-/= followed by letters)
   * Supports C-style escapes, specifiers, and `~`/`^` credential forms.
   */
  argument?: string;
};

/**
 * Parse tmpfiles.d configuration content into an array of entries.
 *
 * Skips comments (lines starting with #) and blank lines.
 * Each valid line has the format:
 *   Type Path Mode User Group Age Argument
 *
 * The first six fields are whitespace-separated and may be quoted;
 * everything after them belongs to the argument field verbatim.
 * Missing trailing fields are omitted.
 *
 * @param content Raw tmpfiles.d configuration file content
 * @returns Array of parsed TmpfilesEntry objects
 */
export function parseTmpFilesConf(content: string): TmpFilesConf {
  const entries: TmpFilesConf = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = splitTmpfilesLine(trimmed);
    if (parts.length < 2) {
      continue;
    }

    const entry = {
      type: parts[0] as TmpfilesType,
      path: parts[1],
      mode: parts.length > 2 && parts[2] !== '-' ? parts[2] : undefined,
      user: parts.length > 3 && parts[3] !== '-' ? parts[3] : undefined,
      group: parts.length > 4 && parts[4] !== '-' ? parts[4] : undefined,
      age: parts.length > 5 && parts[5] !== '-' ? parts[5] : undefined,
      argument: parts.length > 6 && parts[6] !== '-' ? parts[6] : undefined,
    } satisfies TmpFilesEntry;

    entries.push(entry);
  }

  return entries;
}

/**
 * Split a tmpfiles.d line into up to 7 fields.
 * The first six fields honor double quotes; the seventh (argument)
 * is the verbatim remainder of the line.
 */
function splitTmpfilesLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i < line.length && fields.length < 6) {
    while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
      i++;
    }
    if (i >= line.length) break;
    if (line[i] === '"') {
      let value = '';
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length) {
          value += line[i + 1];
          i += 2;
        } else {
          value += line[i];
          i++;
        }
      }
      if (i < line.length) i++;
      fields.push(value);
    } else {
      let value = '';
      while (i < line.length && line[i] !== ' ' && line[i] !== '\t') {
        value += line[i];
        i++;
      }
      fields.push(value);
    }
  }

  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    i++;
  }
  if (i < line.length) {
    fields.push(line.slice(i));
  }

  return fields;
}

/**
 * Serialize an array of TmpfilesEntry objects into tmpfiles.d configuration format.
 *
 * Each entry is output as a space-separated line:
 *   Type Path Mode User Group Age Argument
 *
 * Optional fields that are undefined are rendered as "-".
 * A trailing newline is appended.
 *
 * @param conf Array of TmpfilesEntry objects
 * @returns Formatted tmpfiles.d configuration string
 */
export function serializeTmpFilesConf(conf: TmpFilesConf): string {
  const lines: string[] = [];

  for (const entry of conf) {
    const modeStr =
      entry.mode !== void 0
        ? typeof entry.mode === 'number'
          ? entry.mode.toString(8).padStart(4, '0')
          : entry.mode
        : '-';
    const userStr = entry.user ?? '-';
    const groupStr = entry.group ?? '-';
    const ageStr = entry.age ?? '-';
    const argStr = entry.argument ?? '-';

    lines.push(`${entry.type} ${entry.path} ${modeStr} ${userStr} ${groupStr} ${ageStr} ${argStr}`);
  }

  return lines.join('\n') + '\n';
}
