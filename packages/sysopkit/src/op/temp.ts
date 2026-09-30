/**
 * @module op/temp
 *
 * Temporary file and directory helpers with scoped cleanup.
 *
 * `withTempFile()` / `withTempDir()` create a unique path via `mktemp`,
 * run a callback with it, and remove it afterwards — for staging downloads,
 * generated configs, or command inputs that must take a real file (rather
 * than stdin, which cannot be reopened by path on every transport).
 *
 * These are bare primitives like `writeFile`: they do not check `dryRun`
 * and emit no change events. Callers gate on `ctx.dryRun` and report
 * through their own tasks. Cleanup runs in `finally`, so it still needs a
 * live connection; files may be left behind when the connection dies
 * mid-operation (`/tmp` aging reclaims them).
 */

import { writeFile } from './file.js';
import { $_, sh } from './sh.js';

/** Default `mktemp` template for temp files. */
export const TEMP_FILE_TEMPLATE = '/tmp/sysopkit-XXXXXXXX';

/** Default `mktemp` template for temp directories. */
export const TEMP_DIR_TEMPLATE = '/tmp/sysopkit-XXXXXXXX';

/** Options for `withTempFile()`. */
export interface TempFileOptions {
  /**
   * `mktemp` template (must contain at least six trailing `X`s).
   * Default: `TEMP_FILE_TEMPLATE`.
   */
  readonly template?: string;
  /**
   * Content written to the file. When omitted, the file stays empty.
   */
  readonly content?: string | Uint8Array<ArrayBuffer>;
}

/**
 * Creates a temp file, runs `fn` with its path, and removes the file
 * afterwards — including when `fn` throws.
 *
 * @param fn - Callback receiving the temp file path
 * @param options - Template and optional content
 * @returns Whatever `fn` returns
 */
export async function withTempFile<R>(
  fn: (path: string) => Promise<R>,
  options?: TempFileOptions,
): Promise<R> {
  const { stdout } = await sh(`mktemp ${$_(options?.template ?? TEMP_FILE_TEMPLATE)}`);
  const path = stdout.trim();
  _assertSafeTempPath(path);
  try {
    if (options?.content !== undefined) {
      await writeFile(path, options.content);
    }
    return await fn(path);
  } finally {
    await sh(`rm -f ${$_(path)}`);
  }
}

/** Options for `withTempDir()`. */
export interface TempDirOptions {
  /**
   * `mktemp -d` template (must contain at least six trailing `X`s).
   * Default: `TEMP_DIR_TEMPLATE`.
   */
  readonly template?: string;
}

/**
 * Creates a temp directory, runs `fn` with its path, and removes the
 * directory tree afterwards — including when `fn` throws.
 *
 * @param fn - Callback receiving the temp directory path
 * @param options - Template override
 * @returns Whatever `fn` returns
 */
export async function withTempDir<R>(
  fn: (path: string) => Promise<R>,
  options?: TempDirOptions,
): Promise<R> {
  const { stdout } = await sh(`mktemp -d ${$_(options?.template ?? TEMP_DIR_TEMPLATE)}`);
  const path = stdout.trim();
  _assertSafeTempPath(path);
  try {
    return await fn(path);
  } finally {
    await sh(`rm -rf ${$_(path)}`);
  }
}

/**
 * Rejects empty, root, or parent-referencing paths before destructive
 * removal, so a corrupt `mktemp` result can never escalate `rm -rf`.
 */
function _assertSafeTempPath(path: string): void {
  if (path === '' || path === '/' || path.split('/').includes('..')) {
    throw new Error(`refusing to clean up suspicious temp path '${path}'`);
  }
}
