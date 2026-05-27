/**
 * @module op/rsync
 *
 * File synchronization using rsync.
 *
 * Rsync is a fast, incremental file transfer tool that efficiently synchronizes
 * files between local and remote systems. It uses the "rsync algorithm" to
 * minimize data transfer by only sending the differences between files.
 *
 * @see rsync(1) - fast incremental file transfer
 */

import { text } from 'node:stream/consumers';

import { emitChanged, type ExecutionContext, task } from '../core/context.js';
import { type ChangeEntry } from '../core/events.js';
import { VERBOSITY_NORMAL } from '../core/reporter.js';
import { processSpawn } from '../utils/process.js';
import { $_ } from './sh.js';

/** Configuration for rsync operations. */
export interface RsyncOptions {
  readonly src: string;
  readonly dst: string;
  readonly flags?: string[];
  readonly remove?: boolean;
  readonly user?: string;
  readonly group?: string;
  readonly usermap?: Record<string, string>;
  readonly groupmap?: Record<string, string>;
  readonly rsyncPath?: string;
  readonly signal?: AbortSignal;
}

/** Result of an rsync operation. */
export interface RsyncResult {
  /** Standard output from rsync. */
  readonly stdout: string;
  /** Standard error from rsync. */
  readonly stderr: string;
  /** Exit code (0 for success). */
  readonly exitCode: number;
}

/**
 * Action performed on a file during rsync.
 *
 * - "sent": File content was transferred (partial update)
 * - "created": File was newly created
 * - "touched": File metadata was updated (permissions, timestamps, etc.)
 * - "deleted": File was removed from destination
 */
export type RsyncAction = 'sent' | 'created' | 'touched' | 'deleted';

/**
 * Type of file affected by rsync.
 *
 * - "file": Regular file
 * - "directory": Directory
 * - "symlink": Symbolic link
 */
export type RsyncType = 'file' | 'directory' | 'symlink';

/**
 * Represents a single file change from rsync output.
 *
 * Parsed from rsync's --itemize-changes output format.
 */
export interface RsyncEntry {
  /** Type of file affected. */
  readonly type?: RsyncType;
  /** Action performed on the file. */
  readonly action: RsyncAction;
  /** Path relative to the transfer root. */
  readonly path: string;
  /** Target path for symbolic links (only present for symlinks). */
  readonly target?: string;
}

/**
 * **[IDEMPOTENT]** Synchronizes files from local to remote (push).
 *
 * Pushes files from the local system to a remote host. Uses rsync's
 * incremental transfer to minimize bandwidth usage.
 *
 * @param options - Rsync configuration with source and destination
 * @returns Array of entries describing what was changed
 *
 * @example
 * const changes = await rsyncPush({
 *   src: "./dist/",
 *   dst: "/var/www/html/"
 * });
 * // changes = [{ type: "file", action: "created", path: "index.html" }, ...]
 */
export async function rsyncPush(options: RsyncOptions): Promise<RsyncEntry[]> {
  const { src, dst } = options;
  return task(
    `rsync push ${src} → ${dst}`,
    async (ctx) => {
      const entries = await _rsync(ctx, 'push', options);
      if (entries.length > 0) {
        emitChanged(entries.map(rsyncEntryToChangeEntry));
      }
      return entries;
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

/**
 * **[IDEMPOTENT]** Synchronizes files from remote to local (pull).
 *
 * Pulls files from a remote host to the local system. Uses rsync's
 * incremental transfer to minimize bandwidth usage.
 *
 * @param options - Rsync configuration with source and destination
 * @returns Array of entries describing what was changed
 */
export async function rsyncPull(options: RsyncOptions): Promise<RsyncEntry[]> {
  const { src, dst } = options;
  return task(
    `rsync pull ${src} → ${dst}`,
    async (ctx) => {
      const entries = await _rsync(ctx, 'pull', options);
      if (entries.length > 0) {
        emitChanged(entries.map(rsyncEntryToChangeEntry));
      }
      return entries;
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

/** Converts an RsyncEntry to a ChangeEntry for event emission. */
function rsyncEntryToChangeEntry(entry: RsyncEntry): ChangeEntry {
  return { type: 'rsync', resource: entry.path, property: entry.action };
}

/** Executes the rsync command and returns parsed change entries. */
async function _rsync(
  ctx: ExecutionContext,
  mode: 'push' | 'pull',
  options: RsyncOptions,
): Promise<RsyncEntry[]> {
  const conn = ctx.conn;
  if (conn === null) {
    throw new Error('Cannot rsync: no connector assigned to context');
  }
  let src = options.src;
  let dst = options.dst;
  if (mode === 'push') {
    dst = `${conn.host}:${dst}`;
  } else {
    src = `${conn.host}:${src}`;
  }
  const proc = processSpawn(
    _rsyncCmd(
      src,
      dst,
      options.flags,
      options.remove,
      options.user,
      options.group,
      options.usermap,
      options.groupmap,
      conn.rsh.map($_).join(' '),
      options.rsyncPath,
      ctx.dryRun,
    ),
    options.signal,
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    text(proc.stdout),
    text(proc.stderr),
  ]);
  if (exitCode !== 0) {
    throw new Error(`rsync failed with exit code '${exitCode}':\n${stderr}`);
  }
  return parseRsyncOutput(stdout);
}

/** Builds the rsync command array from options. */
function _rsyncCmd(
  a: string,
  b: string,
  flags?: string[],
  remove: boolean = true,
  user?: string,
  group?: string,
  usermap?: Record<string, string>,
  groupmap?: Record<string, string>,
  rsh?: string,
  rsyncPath?: string,
  dryRun: boolean = false,
): string[] {
  const cmd = ['rsync', '-ivz']; // verbose, itemize-changes, compress
  if (flags) {
    cmd.push(...flags);
  } else {
    cmd.push('-a'); // archive mode is "-rlptgoD"
  }
  if (remove) {
    cmd.push('--delete');
  }
  if (user || group) {
    let owner = ` ${user}`;
    if (group) owner += `:${group}`;
    cmd.push(`--chown=${owner}`);
  }
  if (usermap) {
    cmd.push(
      `--usermap='${Object.entries(usermap)
        .map(([k, v]) => `${k}:${v}`)
        .join(',')}'`,
    );
  }
  if (groupmap) {
    cmd.push(
      `--groupmap='${Object.entries(groupmap)
        .map(([k, v]) => `${k}:${v}`)
        .join(',')}'`,
    );
  }
  if (rsh) {
    cmd.push('-e', rsh);
  }
  if (rsyncPath) {
    cmd.push('--rsync-path', rsyncPath);
  }
  if (dryRun) {
    cmd.push('--dry-run');
  }
  cmd.push(a, b);
  return cmd;
}

const RSYNC_TARGET_RE = /^(.+?)(?: -> (.+))?$/;

/**
 * Parses rsync output into structured entries.
 *
 * Format: `YXcstpoguax <path>[ -> <target>]`
 *
 * Update type (Y):
 * - `<`: File is being sent to remote (sent)
 * - `>`: File is being sent to local host (received)
 * - `c`: File is being created/updated locally
 * - `.`: File exists but is being updated (touched)
 *
 * File type (X):
 * - `f`: Regular file
 * - `d`: Directory
 * - `L`: Symbolic link
 *
 * Example outputs:
 * - `>f+++++++++ newfile.txt` - new file created
 * - `.f..t...... existing.txt` - file touched (metadata changed)
 * - `cL......... link -> target` - symlink created
 * - `*deleting path.txt` - file deleted
 *
 * @param output - Raw stdout from rsync with --itemize-changes
 * @returns Array of parsed rsync entries
 */
function parseRsyncOutput(output: string): RsyncEntry[] {
  const entries: RsyncEntry[] = [];
  for (const line of output.split('\n')) {
    if (line) {
      const c = line[0];
      if (c === '*') {
        if (line.startsWith('*deleting')) {
          entries.push({ action: 'deleted', path: line.slice(12) });
        }
      } else {
        let action: RsyncAction;
        if (c === 'c') {
          action = 'created';
        } else if (c === '>' || c === '<') {
          action = 'sent';
        } else if (c === '.') {
          action = 'touched';
        } else {
          continue;
        }
        const fileType = line[1];
        let type: RsyncType;
        if (fileType === 'f') {
          type = 'file';
        } else if (fileType === 'd') {
          type = 'directory';
        } else if (fileType === 'L') {
          type = 'symlink';
        } else {
          continue;
        }
        let path = line.slice(12);
        let target;
        if (type === 'symlink') {
          const match = RSYNC_TARGET_RE.exec(path);
          if (match) {
            path = match[1];
            target = match[2];
            entries.push({
              type: 'symlink',
              action,
              path,
              target,
            });
          }
        } else {
          entries.push({
            type: fileType === 'f' ? 'file' : 'directory',
            action,
            path,
          });
        }
      }
    }
  }
  return entries;
}
