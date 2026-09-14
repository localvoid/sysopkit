/**
 * @module pkg/apk
 *
 * APK package management for Alpine-based distributions.
 *
 * APK (Alpine Package Keeper) is the package manager for Alpine Linux and
 * Alpine-based distributions, including OpenWrt 25.12 and newer (where it
 * replaced opkg). This module provides operations for package management
 * using only `sh`, so it also works on minimal/busybox environments like
 * OpenWrt (no sudo user, no bash assumptions).
 *
 * @see https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper - APK package manager
 * @see https://openwrt.org/docs/guide-user/additional-software/apk - APK on OpenWrt
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

/** Information about an installed package. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * Lists all installed packages on the system.
 *
 * Uses `apk list -I` to enumerate installed packages with their versions.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh('apk list -I');
  const packages: PackageInfo[] = [];
  for (const line of stdout.split('\n')) {
    const token = line.trim().split(/\s+/, 1)[0];
    if (!token) {
      continue;
    }
    const parsed = _splitNameVersion(token);
    if (parsed) {
      packages.push(parsed);
    }
  }
  return packages;
}

/** Options for installing packages with apk. */
export interface InstallPackagesOptions {
  /** Package names to install. */
  readonly packages: string[];
}

/**
 * Installs packages using apk.
 *
 * Refreshes the package indexes (`-U`) as part of the install. Re-running
 * for already installed packages is a no-op (apk prints only the `OK:`
 * summary without `Installing` lines). Emits change events for packages
 * that are newly installed, including dependencies pulled in. In dry-run
 * mode, uses `--simulate` to preview which packages would change without
 * applying them.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'apk install',
    async (ctx) => {
      const { stdout } = await sh(
        `apk add -U${ctx.dryRun ? ' --simulate' : ''} ${packages.map($_).join(' ')}`,
      );
      const pkgs = _parseProgress(stdout, INSTALLING_LINE_RE);
      if (pkgs.length > 0) {
        emitChanged(
          pkgs.map((p) => ({
            type: 'apk',
            resource: p,
            property: 'state',
            to: 'installed',
          })),
        );
      }
    },
    {
      details: () => ({
        packages: packages.join(' '),
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/** Options for removing packages with apk. */
export interface RemovePackagesOptions {
  /** Package names to remove. */
  readonly packages: string[];
}

/**
 * Removes packages using apk.
 *
 * Dependencies that were installed for the removed packages and are no
 * longer needed are purged as well, and reported as removed. Re-running for
 * absent packages is a no-op. In dry-run mode, uses `--simulate` to preview
 * which packages would be removed without applying the change.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'apk remove',
    async (ctx) => {
      const { stdout } = await sh(
        `apk del${ctx.dryRun ? ' --simulate' : ''} ${packages.map($_).join(' ')}`,
      );
      const pkgs = _parseProgress(stdout, PURGING_LINE_RE);
      if (pkgs.length > 0) {
        emitChanged(
          pkgs.map((p) => ({
            type: 'apk',
            resource: p,
            property: 'state',
            to: 'removed',
          })),
        );
      }
    },
    {
      details: () => ({
        packages: packages.join(' '),
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/** Matches install progress lines (`(3/3) Installing nano (9.2-r1)`). */
const INSTALLING_LINE_RE = /^\(\d+\/\d+\) Installing (\S+) \(/;
/** Matches removal progress lines (`(1/3) Purging nano (9.2-r1)`). */
const PURGING_LINE_RE = /^\(\d+\/\d+\) Purging (\S+) \(/;

/**
 * Parses progress lines from apk output to find changed packages.
 */
function _parseProgress(output: string, re: RegExp): string[] {
  const packages: string[] = [];
  for (const line of output.split('\n')) {
    const match = re.exec(line.trim());
    if (match?.[1]) {
      packages.push(match[1]);
    }
  }
  return packages;
}

/**
 * Splits an `apk list` name-version token (`nano-9.2-r1`, `ca-bundle-20260223-r1`).
 *
 * The name runs up to the first dash followed by a digit; the remainder is
 * the version.
 */
function _splitNameVersion(token: string): PackageInfo | undefined {
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '-' && i + 1 < token.length && /\d/.test(token[i + 1]!)) {
      return {
        name: token.slice(0, i),
        version: token.slice(i + 1),
      };
    }
  }
  return undefined;
}
