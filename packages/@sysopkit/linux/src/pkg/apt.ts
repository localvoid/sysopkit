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

import {
  diffVersionSnapshots,
  splitByPresence,
  splitListedUpgrades,
  type VersionChanges,
} from './snap-diff.js';

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
  readonly version: string;
  readonly arch: string;
}

/**
 * Parses `dpkg-query -W -f='${Package} ${Version} ${Architecture}\n'`
 * output into package metadata.
 *
 * Field values contain no whitespace (Debian policy), so each row splits
 * exactly. Blank lines and malformed rows are skipped; empty output yields
 * `[]`.
 */
export function parseDpkgQuery(stdout: string): PackageInfo[] {
  if (stdout.trim().length === 0) {
    return [];
  }
  const packages: PackageInfo[] = [];
  for (const line of stdout.trim().split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      continue;
    }
    const [name, version, arch] = parts;
    if (!name || !version || !arch) {
      continue;
    }
    packages.push({ name, version, arch });
  }
  return packages;
}

/**
 * Lists all installed packages on the system.
 *
 * Queries the local dpkg database directly, so no repository metadata is
 * loaded and the query works offline.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh(`dpkg-query -W -f='\${Package} \${Version} \${Architecture}\\n'`);
  return parseDpkgQuery(stdout);
}

/** Options for installing packages with apt-get. */
export interface InstallPackagesOptions {
  /** Package names to install. */
  readonly packages: string[];
}

/**
 * Installs packages using apt-get.
 *
 * Change detection diffs dpkg snapshots taken before and after the
 * transaction, so installed dependencies and upgraded packages are reported
 * too. Dry-run previews compare the requested names against the snapshot
 * without running the solver: names absent from the snapshot are reported
 * as installed. Solver-resolved dependencies are not enumerated in
 * previews, and names are not validated against repositories.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'apt install',
    async (ctx) => {
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { absent } = splitByPresence(before, packages);
        if (absent.length > 0) {
          emitChanged(
            absent.map((p) => ({
              type: 'apt',
              resource: p,
              property: 'state',
              to: 'installed',
            })),
          );
        }
        return;
      }
      await sh(`apt-get install -y ${packages.map($_).join(' ')}`);
      emitAptChanges(diffVersionSnapshots(before, await getInstalledPackages()));
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
  /**
   * Remove dependencies that were installed for these packages and are no
   * longer needed (`--auto-remove`). Defaults to false.
   */
  readonly autoremove?: boolean;
}

/**
 * Removes packages using apt-get.
 *
 * Change detection diffs dpkg snapshots taken before and after the
 * transaction. Configuration files are preserved; use purge to remove them
 * as well. Dry-run previews compare the requested names against the
 * snapshot without running the solver: names present in the snapshot are
 * reported as removed. Autoremoved dependencies are not enumerated in
 * previews, and names are not validated against repositories.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages, autoremove = false } = options;
  return task(
    'apt remove',
    async (ctx) => {
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { present } = splitByPresence(before, packages);
        if (present.length > 0) {
          emitChanged(
            present.map((p) => ({
              type: 'apt',
              resource: p,
              property: 'state',
              to: 'removed',
            })),
          );
        }
        return;
      }
      await sh(
        `apt-get remove -y${autoremove ? ' --auto-remove' : ''} ${packages.map($_).join(' ')}`,
      );
      emitAptChanges(diffVersionSnapshots(before, await getInstalledPackages()));
    },
    {
      details: () => ({
        'packages': packages.join(' '),
        'auto-remove': autoremove === void 0 ? void 0 : autoremove ? 'on' : 'off',
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/**
 * Emits one change entry per changed package, grouped by change kind.
 *
 * Shared by snapshot-diff and preview paths so both report the same event
 * shape.
 */
function emitAptChanges(changes: VersionChanges): void {
  const entries = [
    ...changes.updated.map((p) => ({ type: 'apt', resource: p, property: 'state', to: 'updated' })),
    ...changes.installed.map((p) => ({
      type: 'apt',
      resource: p,
      property: 'state',
      to: 'installed',
    })),
    ...changes.removed.map((p) => ({ type: 'apt', resource: p, property: 'state', to: 'removed' })),
  ];
  if (entries.length > 0) {
    emitChanged(entries);
  }
}

/** Options for updating packages with apt-get. */
export interface UpdatePackagesOptions {
  /**
   * Package names to update. Omitted or empty means a full system upgrade
   * (`apt-get full-upgrade`).
   */
  readonly packages?: string[];
}

/** Packages changed by an update transaction, grouped by change kind. */
export interface UpdatePackagesResult {
  /** Packages updated in place. */
  readonly updated: string[];
  /** Newly installed packages (dependencies pulled in by the upgrade). */
  readonly installed: string[];
  /** Packages removed by the transaction (e.g. obsoleted). */
  readonly removed: string[];
}

/**
 * Parses `apt list --upgradable` output into upgradable package names.
 *
 * Each row starts with a `name/distribution` token (`bash/stable ...`);
 * only that token is read, so translated trailing columns (`[upgradable
 * from: ...]`) cannot affect parsing. The `Listing...` header has no `/`
 * in its first token and is skipped by the same rule, as is empty output.
 */
export function parseAptUpgradable(stdout: string): string[] {
  const names: string[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const token = trimmed.split(/\s+/, 1)[0]!;
    const slash = token.indexOf('/');
    if (slash > 0) {
      names.push(token.slice(0, slash));
    }
  }
  return names;
}

/**
 * Updates packages using apt-get.
 *
 * Refreshes the package indexes (`apt-get update`) first, then with no
 * `packages` (or an empty list) upgrades the whole system (`apt-get
 * full-upgrade`, which may install new dependencies and remove obsoleted
 * packages); otherwise upgrades only the named packages (`apt-get install
 * --only-upgrade`, which never installs missing names). Returns the changed
 * package names grouped by change kind and emits a change event per group.
 * Real transactions are detected by diffing dpkg snapshots. Dry-run
 * previews list upgradable packages via `apt list --upgradable` (no table
 * parsing) and map them against the snapshot; newly installed dependencies
 * and removals need the solver transaction and are not predicted.
 */
export async function updatePackages(
  options?: UpdatePackagesOptions,
): Promise<UpdatePackagesResult> {
  const packages = options?.packages;
  return task(
    'apt upgrade',
    async (ctx) => {
      if (packages !== void 0) {
        if (
          !Array.isArray(packages) ||
          packages.some((p) => typeof p !== 'string' || p.length === 0)
        ) {
          throw new Error('packages must be an array of package names when provided');
        }
      }
      const scoped = Array.isArray(packages) && packages.length > 0;
      await sh('apt-get update');
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { stdout } = await sh('apt list --upgradable');
        const changes = splitListedUpgrades(
          parseAptUpgradable(stdout),
          new Set(before.map((p) => p.name)),
          scoped ? packages : void 0,
        );
        emitAptChanges(changes);
        return changes;
      }
      if (Array.isArray(packages) && packages.length > 0) {
        await sh(`apt-get install --only-upgrade -y ${packages.map($_).join(' ')}`);
      } else {
        await sh('apt-get full-upgrade -y');
      }
      const changes = diffVersionSnapshots(before, await getInstalledPackages());
      emitAptChanges(changes);
      return changes;
    },
    {
      details: () => ({
        packages: Array.isArray(packages) && packages.length > 0 ? packages.join(' ') : '(all)',
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}
