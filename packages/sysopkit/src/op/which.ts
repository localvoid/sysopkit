/**
 * @module op/which
 *
 * Tool path resolution via `command -v`.
 *
 * Binary paths drift across releases (trixie puts `wipefs` in
 * `/usr/sbin`, `btrfs` in `/usr/bin`), so consumers that embed paths
 * (initramfs hooks and similar) must resolve at runtime instead of
 * hardcoding them.
 */

import { task } from '../core/context.js';
import { VERBOSITY_TRACE } from '../core/reporter.js';
import { $_, sh } from './sh.js';

/**
 * Resolves one tool name to an absolute path via `command -v`.
 *
 * Returns `undefined` when the tool is not installed. Still throws
 * on malformed tool names.
 */
export async function tryWhich(name: string): Promise<string | undefined> {
  if (name === '' || /[\s"'`$\\]/.test(name)) {
    throw new Error(`refusing: bad tool name '${name}'`);
  }
  const { stdout } = await sh(`command -v ${$_(name)} || true`);
  const path = stdout.trim().split('\n')[0] ?? '';
  if (path === '' || !path.startsWith('/')) {
    return undefined;
  }
  return path;
}

/**
 * Resolves one tool name to an absolute path via `command -v`.
 *
 * Throws when the tool is not installed.
 */
export async function which(name: string): Promise<string> {
  const path = await tryWhich(name);
  if (path === undefined) {
    throw new Error(`tool '${name}' not installed`);
  }
  return path;
}

/**
 * Resolves tool names to absolute paths, in order.
 *
 * Throws on the first missing tool.
 */
export async function resolveTools(names: readonly string[]): Promise<string[]> {
  return task(
    'resolve tools',
    async () => {
      const paths: string[] = [];
      for (const name of names) {
        paths.push(await which(name));
      }
      return paths;
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
