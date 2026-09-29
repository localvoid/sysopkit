/**
 * @module middleware/chroot
 *
 * Chroot confinement.
 *
 * Provides middleware to execute commands inside a chroot directory
 * (e.g. an installed system mounted at `/target` during OS installation).
 */

import { type Connector } from '../core/connector.js';
import { type ExecutionContext } from '../core/context.js';
import { ConnectorMiddleware, middleware } from '../core/middleware.js';
import { type Process } from '../utils/process.js';

/**
 * Executes a function with all commands confined to a chroot directory.
 *
 * Every `spawn` in scope is prefixed with `chroot <root>`, so absolute
 * paths in commands resolve against the new root. File operations that
 * go through `spawn` (e.g. `createFile`, `sh`, `exec`) therefore take
 * chroot-relative paths (`/etc/hostname`, not `<root>/etc/hostname`).
 */
export function chroot<R>(root: string, fn: (ctx: ExecutionContext) => Promise<R>): Promise<R> {
  assertChrootRoot(root);
  return middleware('chroot', fn, (next) => new ChrootMiddleware(next, root), {
    info: () => ({
      root,
    }),
  });
}

/** Throws unless `root` is a usable chroot directory. */
function assertChrootRoot(root: string): void {
  if (root === '') {
    throw new Error('refusing: chroot root must not be empty');
  }
  if (!root.startsWith('/')) {
    throw new Error(`refusing: chroot root must be absolute, got '${root}'`);
  }
  if (root === '/') {
    throw new Error("refusing: chroot root must not be '/' (no-op confinement)");
  }
}

/**
 * Middleware that prefixes commands with `chroot <root>`.
 *
 * Pure per-`spawn` argv rewrite, following `TransformCmdMiddleware`:
 * returns a new array, never mutates the input.
 */
export class ChrootMiddleware extends ConnectorMiddleware {
  /** Chroot directory commands are confined to. */
  readonly root: string;

  constructor(next: Connector, root: string) {
    super(next);
    assertChrootRoot(root);
    this.root = root;
  }

  override spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    return super.spawn(['chroot', this.root, ...cmd], signal);
  }
}
