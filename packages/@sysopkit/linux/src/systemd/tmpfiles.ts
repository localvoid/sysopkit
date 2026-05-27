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
 * - L/L+: Create symlink (L+ replaces existing)
 * - c/c+/b/b+: Create device node
 * - C/C+: Copy files/directories
 * - x/X: Ignore during cleaning (X doesn't ignore contents)
 * - r/R: Remove path (R recursive)
 * - z/Z: Adjust mode/ownership (Z recursive)
 * - t/T: Set extended attributes (T recursive)
 * - h/H: Set file attributes (H recursive)
 * - a/a+/A/A+: Set POSIX ACLs (recursive with A/A+)
 *
 * Type modifiers (suffix to type letter):
 * - !: Only safe during boot (--boot option required)
 * - -: Ignore errors during create
 * - =: Check file type, remove if mismatch
 * - ~: Base64 decode the argument field
 * - ^: Read argument from credential
 * - $: Subject to removal with --purge
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
   * Prefix with "~" to mask based on existing permissions.
   */
  mode?: string | number;

  /**
   * User name or UID. Use "-" for current user.
   */
  user?: string;

  /**
   * Group name or GID. Use "-" for current group.
   */
  group?: string;

  /**
   * Age for time-based cleanup (e.g., "10d", "1w", "30s").
   * Files older than this are deleted during --clean.
   * Use "0" for unconditional cleanup.
   * Use "-" to disable cleanup.
   */
  age?: string;

  /**
   * Argument field contents. Meaning depends on type:
   * - f/w: Content to write to file
   * - L: Symlink target path
   * - c/b: Device major:minor (e.g., "1:3")
   * - C: Source path to copy from
   * - t/T: Extended attributes (namespace.attr=value)
   * - a/A: POSIX ACLs
   * - h/H: File attributes (+/-/= followed by letters)
   */
  argument?: string;
};

/**
 * Parse tmpfiles.d configuration content into an array of entries.
 *
 * Skips comments (lines starting with # or ;) and blank lines.
 * Each valid line has the format:
 *   Type Path Mode User Group Age Argument
 *
 * Fields are whitespace-separated. Missing trailing fields are omitted.
 *
 * @param content Raw tmpfiles.d configuration file content
 * @returns Array of parsed TmpfilesEntry objects
 */
export function parseTmpFilesConf(content: string): TmpFilesConf {
  const entries = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
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
      argument: parts.length > 6 && parts[6] !== '-' ? parts.slice(6).join(' ') : undefined,
    } satisfies TmpFilesEntry;

    entries.push(entry);
  }

  return entries;
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
