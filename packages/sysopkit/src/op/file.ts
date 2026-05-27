/**
 * @module op/file
 *
 * File system helpers for managing files, directories, and permissions.
 *
 * These helpers wrap standard Unix commands for file manipulation:
 * - `cat` for writing files
 * - `test` for file type checks
 * - `mkdir`, `ln`, `chmod`, `chown`, `touch`, `mv`, `rm` for file operations
 * - `stat` for file metadata
 */

import type { ExecutionContext } from '../core/context.js';
import { emitChanged, task } from '../core/context.js';
import { VERBOSITY_NORMAL, VERBOSITY_TRACE } from '../core/reporter.js';
import { sleep } from '../core/sleep.js';
import { $_, sh } from './sh.js';

/** Path type: regular file. */
const PATH_REGULAR_FILE = 1;
/** Path type: directory. */
const PATH_DIRECTORY = 2;
/** Path type: symbolic link. */
const PATH_SYMLINK = 3;
/** Path type: socket. */
const PATH_SOCKET = 4;
/** Path type: pipe (FIFO). */
const PATH_PIPE = 5;
/** Path type: character device. */
const PATH_CHARACTER_DEVICE = 6;
/** Path type: block device. */
const PATH_BLOCK_DEVICE = 7;

export type PathType = 'file' | 'dir' | 'link' | 'socket' | 'pipe' | 'char' | 'block';

/** Converts a PathType constant to a human-readable string. */
function _pathType(type: number): PathType {
  switch (type) {
    case PATH_REGULAR_FILE:
      return 'file';
    case PATH_DIRECTORY:
      return 'dir';
    case PATH_SYMLINK:
      return 'link';
    case PATH_SOCKET:
      return 'socket';
    case PATH_PIPE:
      return 'pipe';
    case PATH_CHARACTER_DEVICE:
      return 'char';
    case PATH_BLOCK_DEVICE:
      return 'block';
  }
  throw new Error(`Unknown file type ${type}`);
}

/** Permission flag: file is executable. */
export const PATH_EXECUTABLE = 1;
/** Permission flag: file is writable. */
export const PATH_WRITABLE = 2;
/** Permission flag: file is readable. */
export const PATH_READABLE = 4;

export type PathPermissions = typeof PATH_READABLE | typeof PATH_WRITABLE | typeof PATH_EXECUTABLE;

/** Path type and permission information. */
export interface PathInfo {
  readonly type: PathType;
  readonly perm: PathPermissions;
}

/** Gets the type and permissions of a path, or undefined if it doesn't exist. */
export async function getPathInfo(path: string): Promise<PathInfo | undefined> {
  const { stdout } = await sh(_pathInfoCmd(path));
  const bits = parseInt(stdout, 10);
  if (bits === 0) {
    return void 0;
  }
  return {
    type: _pathType(bits >> 3),
    perm: (bits & 7) as PathPermissions,
  };
}

/** Generates a shell command to encode path type and permissions into a single integer. */
export function _pathInfoCmd(path: string): string {
  return `p=${$_(path)};m=0;if [ ! -e "$p" ]&&[ ! -L "$p" ];then echo 0;exit;fi;[ -r "$p" ]&&m=$((m+=4));[ -w "$p" ]&&m=$((m+=2));[ -x "$p" ]&&m=$((m+=1));if [ -L "$p" ];then m=$((m+=24));elif [ -f "$p" ];then m=$((m+=8));elif [ -d "$p" ];then m=$((m+=16));elif [ -S "$p" ];then m=$((m+=32));elif [ -p "$p" ];then m=$((m+=40));elif [ -c "$p" ];then m=$((m+=48));elif [ -b "$p" ];then m=$((m+=56));fi;echo $m`;
}

/** Writes content to a file using `cat >`. */
export async function writeFile(
  path: string,
  content: string | Uint8Array<ArrayBuffer>,
): Promise<void> {
  await sh(`cat > ${$_(path)}`, { stdin: content });
}

/** Reads a file as string, returning undefined if not found. */
export async function tryReadFile(path: string): Promise<string | undefined> {
  const { stdout, exitCode } = await sh(`p=${$_(path)};[ -f "$p" ]||exit 64;cat "$p"`);
  if (exitCode === 64) {
    return void 0;
  }
  return stdout;
}

/** Reads a file as Uint8Array, returning undefined if not found. */
export async function tryReadFileBuffer(path: string): Promise<Uint8Array | undefined> {
  const { stdout, exitCode } = await sh(`p=${$_(path)};[ -f "$p" ]||exit 64;cat "$p"`, {
    stdout: 'buffer',
  });
  if (exitCode === 64) {
    return void 0;
  }
  return stdout;
}

/** Reads a file as string. Throws if the file doesn't exist. */
export async function readFile(path: string): Promise<string> {
  const { stdout } = await sh(`cat ${$_(path)}`);
  return stdout;
}

/** Reads a file as Uint8Array. Throws if the file doesn't exist. */
export async function readFileBuffer(path: string): Promise<Uint8Array> {
  const { stdout } = await sh(`cat ${$_(path)}`, { stdout: 'buffer' });
  return stdout;
}

/** File status information from `stat`. */
export interface FileStat {
  readonly type: string;
  readonly user: string;
  readonly group: string;
  readonly mode: number;
  readonly atime: number;
  readonly mtime: number;
  readonly ctime: number;
  readonly size: number;
}

/** Gets file status using `stat`. */
export async function getFileStat(path: string): Promise<FileStat> {
  const { stdout } = await sh(`stat -c '%F\n%U\n%G\n%a\n%X\n%Y\n%Z\n%s' ${$_(path)}`);
  const parts = stdout.trim().split('\n');
  return {
    type: parts[0],
    user: parts[1],
    group: parts[2],
    mode: parseInt(parts[3], 8),
    atime: parseInt(parts[4], 10),
    mtime: parseInt(parts[5], 10),
    ctime: parseInt(parts[6], 10),
    size: parseInt(parts[7], 10),
  };
}

/** Configuration for touchFile operation. */
export interface TouchFileOptions {
  readonly path: string;
}

/**
 * **[IDEMPOTENT]** Updates file timestamps using `touch`.
 *
 * Creates the file if it doesn't exist.
 */
export async function touchFile({ path }: TouchFileOptions): Promise<void> {
  return task(
    `touch ${path}`,
    async (ctx) => {
      if (!ctx.dryRun) await sh(`touch ${$_(path)}`);
      emitChanged({
        type: 'file',
        resource: path,
        property: 'state',
        to: 'touched',
      });
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

/** Computes the SHA256 hash of a file. */
export async function sha256(path: string): Promise<string> {
  const { stdout } = await sh(`sha256sum ${$_(path)}`);
  return stdout.trim().split(/\s+/)[0];
}

/** Common options for file creation. */
export interface CreateCommonFileOptions {
  readonly path: string;
  readonly mode?: number | undefined;
  readonly user?: string | undefined;
  readonly group?: string | undefined;
  readonly atime?: number;
  readonly mtime?: number;
  readonly attributes?: string[];
}

/** Options for creating a regular file. */
export interface CreateFileOptions extends CreateCommonFileOptions {
  readonly type?: 'file';
  readonly content: string | Uint8Array<ArrayBuffer>;
}

/**
 * **[IDEMPOTENT]** Creates or updates a file, directory, or symbolic link.
 *
 * For regular files, compares content via SHA256 and only writes if changed.
 * For existing files, updates mode, ownership, timestamps, and attributes
 * only when they differ from the desired state.
 *
 * @param options - Creation options including type, path, content, and metadata
 */
export async function createFile({
  path,
  mode,
  user,
  group,
  atime,
  mtime,
  attributes,
  content,
}: CreateFileOptions): Promise<void> {
  return task(
    `create file ${path}`,
    async (ctx) => {
      const pathInfo = await getPathInfo(path);
      if (pathInfo) {
        const hashBuf = await crypto.subtle.digest('SHA-256', Buffer.from(content));
        const hash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const remoteHash = await sha256(path);
        if (hash !== remoteHash) {
          if (!ctx.dryRun) await writeFile(path, content);
          emitChanged({
            type: 'file',
            resource: path,
            property: 'content',
            to: 'changed',
          });
        }

        await _updateFileStat(ctx, path, mode, user, group, atime, mtime, attributes);
      } else {
        if (!ctx.dryRun) {
          await writeFile(path, content);
          if (mode !== void 0) {
            await sh(`chmod ${mode.toString(8)} ${$_(path)}`);
          }
          if (user !== void 0 || group !== void 0) {
            let owner = '';
            if (user !== void 0) owner = user;
            if (group !== void 0) owner += `:${group}`;
            await sh(`chown ${$_(`${owner}`)} ${$_(path)}`);
          }
        }
        emitChanged({
          type: 'file',
          resource: path,
          property: 'state',
          to: 'created',
        });
      }
    },
    {
      details: () => ({
        mode: mode && `0o${mode.toString(8)}`,
        user,
        group,
        atime: atime,
        mtime: mtime,
        attributes: attributes && attributes.join(''),
      }),
      verbosity: VERBOSITY_NORMAL,
    },
  );
}

/** Options for creating a directory. */
export interface CreateDirOptions extends CreateCommonFileOptions {
  readonly recursive?: boolean;
}

/**
 * **[IDEMPOTENT]** Creates or updates a directory.
 *
 * For existing directoris, updates mode, ownership, timestamps, and attributes
 * only when they differ from the desired state.
 *
 * @param options - Creation options including type, path, content, and metadata
 */
export async function createDir({
  path,
  mode,
  user,
  group,
  atime,
  mtime,
  attributes,
  recursive,
}: CreateDirOptions): Promise<void> {
  return task(
    `create dir ${path}`,
    async (ctx) => {
      const pathInfo = await getPathInfo(path);
      if (pathInfo) {
        if (pathInfo.type !== 'dir') {
          throw new Error(
            `failed to create a directory at ${path}, file has a "${pathInfo.type}" type`,
          );
        }

        await _updateFileStat(ctx, path, mode, user, group, atime, mtime, attributes);
      } else {
        if (!ctx.dryRun) await sh(`mkdir ${recursive ? '-p ' : ''}${$_(path)}`);
        emitChanged({
          type: 'dir',
          resource: path,
          property: 'state',
          to: 'created',
        });
      }
    },
    {
      details: () => ({
        mode: mode && `0o${mode.toString(8)}`,
        user,
        group,
        atime: atime,
        mtime: mtime,
        attributes: attributes && attributes.join(''),
        recursive: String(recursive),
      }),
      verbosity: VERBOSITY_NORMAL,
    },
  );
}

/** Options for creating a symbolic link. */
export interface CreateLinkOptions extends CreateCommonFileOptions {
  readonly target: string;
}

/**
 * **[IDEMPOTENT]** Creates or updates a symbolic link.
 *
 * For existing links, updates mode, ownership, timestamps, and attributes
 * only when they differ from the desired state.
 *
 * @param options - Creation options including type, path, content, and metadata
 */
export async function createLink({
  path,
  user,
  group,
  atime,
  mtime,
  attributes,
  target,
}: CreateLinkOptions): Promise<void> {
  return task(
    `create file ${path}`,
    async (ctx) => {
      const pathInfo = await getPathInfo(path);
      if (pathInfo) {
        if (pathInfo.type !== 'link') {
          throw new Error(
            `failed to create a symbolic link at ${path}, file has a "${pathInfo.type}" type`,
          );
        }
        const { stdout } = await sh(`readlink -n ${$_(path)}`);
        if (stdout !== target) {
          if (!ctx.dryRun) await sh(`ln -snf ${$_(target)} ${$_(path)}`);
          emitChanged({
            type: 'link',
            resource: path,
            property: 'target',
            to: target,
            from: stdout,
          });
        }

        await _updateFileStat(ctx, path, void 0, user, group, atime, mtime, attributes);
      } else {
        if (!ctx.dryRun) await sh(`ln -sn ${$_(target)} ${$_(path)}`);
        emitChanged({
          type: 'link',
          resource: path,
          property: 'target',
          to: target,
        });
      }
    },
    {
      details: () => ({
        user,
        group,
        atime: atime,
        mtime: mtime,
        attributes: attributes && attributes.join(''),
      }),
      verbosity: VERBOSITY_NORMAL,
    },
  );
}

async function _updateFileStat(
  ctx: ExecutionContext,
  path: string,
  mode?: number,
  user?: string,
  group?: string,
  atime?: number,
  mtime?: number,
  attributes?: string[],
): Promise<void> {
  if (
    mode !== void 0 ||
    user !== void 0 ||
    group !== void 0 ||
    atime !== void 0 ||
    mtime !== void 0
  ) {
    const remoteStat = await getFileStat(path);
    if (mode !== void 0 && remoteStat.mode !== mode) {
      if (!ctx.dryRun) await sh(`chmod ${mode.toString(8)} ${$_(path)}`);
      emitChanged({
        type: 'file',
        resource: path,
        property: 'mode',
        from: `0o${remoteStat.mode.toString(8)}`,
        to: `0o${mode.toString(8)}`,
      });
    }
    if (
      (user !== void 0 && remoteStat.user !== user) ||
      (group !== void 0 && remoteStat.group !== group)
    ) {
      const changes = [];
      if (user !== void 0 && remoteStat.user !== user) {
        changes.push({
          type: 'file',
          resource: path,
          property: 'user',
          from: remoteStat.user,
          to: user,
        });
      }
      if (group !== void 0 && remoteStat.group !== group) {
        changes.push({
          type: 'file',
          resource: path,
          property: 'user',
          from: remoteStat.group,
          to: group,
        });
      }
      if (!ctx.dryRun) {
        let owner = '';
        if (user !== void 0) owner = user;
        if (group !== void 0) owner += `:${group}`;
        await sh(`chown ${$_(`${owner}`)} ${$_(path)}`);
      }
      emitChanged(changes);
    }
    if (atime !== void 0 && remoteStat.atime !== atime) {
      if (!ctx.dryRun) await sh(`touch -a -t ${_formatTouchTime(atime)} ${$_(path)}`);
      emitChanged({
        type: 'file',
        resource: path,
        property: 'atime',
        from: String(remoteStat.atime),
        to: String(atime),
      });
    }
    if (mtime !== void 0 && remoteStat.mtime !== mtime) {
      if (!ctx.dryRun) await sh(`touch -m -t ${_formatTouchTime(mtime)} ${$_(path)}`);
      emitChanged({
        type: 'file',
        resource: path,
        property: 'mtime',
        from: String(remoteStat.mtime),
        to: String(mtime),
      });
    }
  }

  if (attributes !== void 0 && attributes.length > 0) {
    const currentAttrs = await _getAttr(path);
    const nextSet = new Set(attributes);
    const prevSet = new Set(currentAttrs);
    if (nextSet.size !== prevSet.size || [...nextSet].some((a) => !prevSet.has(a))) {
      if (!ctx.dryRun) await sh(`chattr ${$_(attributes.join(''))} ${$_(path)}`);
      emitChanged({
        type: 'file',
        resource: path,
        property: 'attributes',
        from: currentAttrs.join(''),
        to: attributes.join(''),
      });
    }
  }
}

export interface DeleteFileOptions {
  readonly path: string;
}

/**
 * **[IDEMPOTENT]** Deletes a file.
 *
 * Does nothing if the path doesn't exist.
 */
export async function deleteFile({ path }: DeleteFileOptions): Promise<void> {
  return task(
    `delete file ${path}`,
    async (ctx) => {
      const pathInfo = await getPathInfo(path);
      if (pathInfo) {
        if (pathInfo.type !== 'file') {
          throw new Error(`failed to delete a file at ${path}, file has a "${pathInfo.type}" type`);
        }
        if (!ctx.dryRun) await sh(`rm -f ${$_(path)}`);
        emitChanged({
          type: 'file',
          resource: path,
          property: 'state',
          to: 'deleted',
        });
      }
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

export interface DeleteDirOptions {
  readonly path: string;
  readonly recursive?: boolean;
}

/**
 * **[IDEMPOTENT]** Deletes a file.
 *
 * Does nothing if the path doesn't exist.
 */
export async function deleteDir({ path, recursive }: DeleteDirOptions): Promise<void> {
  return task(
    `delete dir ${path}${recursive ? ' (recursive)' : ''}`,
    async (ctx) => {
      const pathInfo = await getPathInfo(path);
      if (pathInfo) {
        if (pathInfo.type !== 'dir') {
          throw new Error(
            `failed to delete a directory at ${path}, file has a "${pathInfo.type}" type`,
          );
        }
        if (!ctx.dryRun) {
          let cmd = 'rm -f';
          if (recursive) cmd += 'r';
          cmd += ` ${$_(path)}`;
          await sh(cmd);
        }
        emitChanged({
          type: 'dir',
          resource: path,
          property: 'state',
          to: 'deleted',
        });
      }
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

export interface DeleteLinkOptions {
  readonly path: string;
}

/**
 * **[IDEMPOTENT]** Deletes a symbolic link.
 *
 * Does nothing if the path doesn't exist.
 */
export async function deleteLink({ path }: DeleteLinkOptions): Promise<void> {
  return task(
    `delete file ${path}`,
    async (ctx) => {
      const pathInfo = await getPathInfo(path);
      if (pathInfo) {
        if (pathInfo.type !== 'link') {
          throw new Error(
            `failed to delete a symbolic link at ${path}, file has a "${pathInfo.type}" type`,
          );
        }
        if (!ctx.dryRun) await sh(`rm -f ${$_(path)}`);
        emitChanged({
          type: 'link',
          resource: path,
          property: 'state',
          to: 'deleted',
        });
      }
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

/** Configuration for waitPath operation. */
export interface WaitPathOptions {
  readonly path: string;
  readonly delay?: number;
  readonly perm?: PathPermissions;
}

/**
 * Waits for a path to exist with optional permission checks.
 *
 * @param options - Path wait configuration
 *
 * @example
 * // Wait for a file to be created
 * await waitFilePath({ path: "/tmp/ready" });
 */
export async function waitFilePath({ path, perm, delay = 1000 }: WaitPathOptions): Promise<void> {
  return task(
    `wait path ${path}`,
    async (ctx) => {
      while (true) {
        ctx.signal.throwIfAborted();
        const info = await getPathInfo(path);
        if (info === void 0) {
          await sleep(delay);
          continue;
        }
        if (perm !== void 0 && (info.perm & perm) !== perm) {
          await sleep(delay);
          continue;
        }
        break;
      }
    },
    { verbosity: VERBOSITY_TRACE },
  );
}

/** Configuration for waitFileContent operation. */
export interface WaitFileContentOptions {
  readonly path: string;
  readonly regex: string;
  readonly delay?: number;
  readonly state?: 'present' | 'absent';
}

/**
 * Waits for a file to contain (or not contain) a regex pattern.
 *
 * Uses `grep -q` for content matching.
 *
 * @param options - File content wait configuration
 *
 * @example
 * // Wait for a file to contain a specific pattern
 * await waitFileContent({ path: "/var/log/app.log", regex: "Server started" });
 *
 * @example
 * // Wait for a pattern to be absent from file
 * await waitFileContent({ path: "/var/log/app.log", regex: "error", state: "absent" });
 */
export async function waitFileContent({
  path,
  regex,
  state = 'present',
  delay = 1000,
}: WaitFileContentOptions): Promise<void> {
  return task(
    `wait file content ${path}`,
    async (ctx) => {
      const targetPresent = state === 'present';

      while (true) {
        ctx.signal.throwIfAborted();

        const { exitCode } = await sh(`grep -q ${$_(regex)} ${$_(path)}||exit 64`);
        const found = exitCode === 0;
        if (found !== targetPresent) {
          await sleep(delay);
          continue;
        }
        break;
      }
    },
    { details: () => ({ regex: regex.toString() }), verbosity: VERBOSITY_TRACE },
  );
}

/** Gets file attributes using `lsattr`. Returns empty array on failure. */
async function _getAttr(path: string): Promise<string[]> {
  const { stdout, exitCode } = await sh(`lsattr -d ${$_(path)};[ $? -eq 1 ]&&exit 64||exit $?`);
  if (exitCode !== 0) return [];
  const line = stdout.trim().split('\n')[0];
  if (!line) return [];
  const match = /^\s*([aAcCdDeEiFijmNPpsStTux-]*)\s/.exec(line);
  if (!match) return [];
  return match[1].split('').filter((c) => c !== '-');
}

/** Formats a Date or epoch timestamp to touch -t format (YYYYMMDDhhmm.ss). */
function _formatTouchTime(time: Date | number): string {
  const d = typeof time === 'number' ? new Date(time * 1000) : time;
  const year = d.getFullYear();
  const month = _padNum(d.getMonth() + 1);
  const day = _padNum(d.getDate());
  const hour = _padNum(d.getHours());
  const min = _padNum(d.getMinutes());
  const sec = _padNum(d.getSeconds());
  return `${year}${month}${day}${hour}${min}.${sec}`;
}

/** Pads a number to 2 digits with leading zeros. */
function _padNum(n: number): string {
  return n.toString().padStart(2, '0');
}
