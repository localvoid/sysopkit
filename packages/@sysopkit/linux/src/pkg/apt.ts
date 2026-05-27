/**
 * @module pkg/apt
 *
 * APT package and repository management for Debian/Ubuntu-based systems.
 *
 * APT (Advanced Package Tool) is the package manager for Debian, Ubuntu, and
 * their derivatives. This module provides operations for package management
 * and repository configuration.
 *
 * @see apt-get(8) - APT package handling utility
 * @see dpkg-query(1) - tool to query the dpkg database
 * @see sources.list(5) - APT sources list format
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

/** APT repository entry parsed from sources.list format. */
export type AptRepo = {
  readonly line: string;
  readonly type: 'deb' | 'deb-src';
  readonly url: string;
  readonly distribution: string;
  readonly components: readonly string[];
};

/** Information about an installed package. */
export interface PackageInfo {
  readonly name: string;
}

/**
 * Lists all installed packages on the system.
 *
 * Uses dpkg-query to enumerate packages in the dpkg database.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh(`dpkg-query -W -f='\${Package}\\n'`);
  if (stdout.length > 0) {
    return stdout
      .trim()
      .split('\n')
      .map((name) => ({
        name,
      }));
  }
  return [];
}

/** Options for installing packages with apt-get. */
export interface InstallPackagesOptions {
  /** Package names to install. */
  readonly packages: string[];
}

/**
 * Installs packages using apt-get.
 *
 * Emits change events for packages that are newly installed. In dry-run mode,
 * uses `-s` (simulate) flag to preview changes without applying them.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'apt install',
    async (ctx) => {
      const { stdout } = await sh(
        `LANG=en_US.UTF-8 apt-get install ${ctx.dryRun ? '-s' : '-y'} ${packages.map($_).join(' ')}`,
      );
      const pkgs = _parseList(stdout, NEW_PACKAGES_RE);
      if (pkgs.length > 0) {
        emitChanged(
          pkgs.map((p) => ({
            type: 'apt',
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

/** Options for removing packages with apt-get. */
export interface RemovePackagesOptions {
  /** Package names to remove. */
  readonly packages: string[];
}

/**
 * Removes packages using apt-get.
 *
 * Emits change events for packages that are removed. Configuration files are
 * preserved; use purge to remove them as well.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'apt remove',
    async (ctx) => {
      const { stdout } = await sh(
        `LANG=en_US.UTF-8 apt-get remove ${ctx.dryRun ? '-s' : '-y'} ${packages.map($_).join(' ')}`,
      );
      const pkgs = _parseList(stdout, REMOVED_RE);
      if (pkgs.length > 0) {
        emitChanged(
          pkgs.map((p) => ({
            type: 'apt',
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

/** Matches the "NEW packages will be installed" section in apt-get output. */
const NEW_PACKAGES_RE = /The following NEW packages will be installed:\n([\s\S]*?)(?=\n\S|$)/;
/** Matches the "packages will be REMOVED" section in apt-get output. */
const REMOVED_RE = /The following packages will be REMOVED:\n([\s\S]*?)(?=\n\S|$)/;

/**
 * Parses the list from apt output to find packages.
 */
function _parseList(output: string, re: RegExp): string[] {
  const match = re.exec(output);
  if (!match || !match[1]) return [];

  return match[1]
    .trim()
    .split(/\s+/)
    .filter((pkg) => pkg.length > 0);
}
