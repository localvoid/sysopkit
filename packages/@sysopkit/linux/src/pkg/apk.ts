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

import {
  diffVersionSnapshots,
  splitByPresence,
  splitListedUpgrades,
  type VersionChanges,
} from './snap-diff.js';

/** Information about an installed package. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * Parses the apk installed database (`/lib/apk/db/installed`) into package
 * metadata.
 *
 * Each installed package is one record with single-letter field tags;
 * `P:` carries the full name and `V:` the version, so no name/version
 * heuristics are needed (names may contain spaces and dashes, e.g.
 * `apk-mbedtls`). Only uppercase `P:` starts a record (lowercase `p:`
 * lines list provides and are ignored). Records without both fields are
 * skipped; empty output yields `[]`.
 */
export function parseApkDb(stdout: string): PackageInfo[] {
  const packages: PackageInfo[] = [];
  let name: string | undefined;
  let version: string | undefined;
  const flush = (): void => {
    if (name !== void 0 && version !== void 0) {
      packages.push({ name, version });
    }
    name = void 0;
    version = void 0;
  };
  for (const line of stdout.split('\n')) {
    if (line.startsWith('P:')) {
      flush();
      const value = line.slice(2).trim();
      if (value.length > 0) {
        name = value;
      }
    } else if (line.startsWith('V:')) {
      const value = line.slice(2).trim();
      if (value.length > 0) {
        version = value;
      }
    }
  }
  flush();
  return packages;
}

/**
 * Lists all installed packages on the system.
 *
 * Reads the local apk database directly (`/lib/apk/db/installed`, the
 * compiled-in default location on Alpine and OpenWrt), so no repository
 * metadata is loaded and the query works offline.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh('cat /lib/apk/db/installed');
  return parseApkDb(stdout);
}

/** Options for installing packages with apk. */
export interface InstallPackagesOptions {
  /** Package names to install. */
  readonly packages: string[];
}

/**
 * Installs packages using apk.
 *
 * Refreshes the package indexes (`-U`) as part of the install. Change
 * detection diffs installed-database snapshots taken before and after the
 * transaction, so installed dependencies and upgraded packages are reported
 * too. Dry-run previews compare the requested names against the snapshot
 * without running the solver: names absent from the snapshot are reported
 * as installed. Solver-resolved dependencies are not enumerated in
 * previews, and names are not validated against repositories.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'apk install',
    async (ctx) => {
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { absent } = splitByPresence(before, packages);
        if (absent.length > 0) {
          emitChanged(
            absent.map((p) => ({
              type: 'apk',
              resource: p,
              property: 'state',
              to: 'installed',
            })),
          );
        }
        return;
      }
      await sh(`apk add -U ${packages.map($_).join(' ')}`);
      emitApkChanges(diffVersionSnapshots(before, await getInstalledPackages()));
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
 * **[IDEMPOTENT]** Missing packages are skipped (apk exits non-zero for
 * `No such package`, so re-running for absent packages is a no-op without
 * throwing). Change detection diffs installed-database snapshots taken
 * before and after the transaction; dependencies that were installed for
 * the removed packages and are no longer needed are purged as well, and
 * reported as removed. Dry-run previews compare the requested names
 * against the snapshot without running the solver: names present in the
 * snapshot are reported as removed. Autoremoved dependencies are not
 * enumerated in previews, and names are not validated against repositories.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'apk remove',
    async (ctx) => {
      const before = await getInstalledPackages();
      const { present } = splitByPresence(before, packages);
      if (present.length === 0) {
        return;
      }
      if (ctx.dryRun) {
        emitChanged(
          present.map((p) => ({
            type: 'apk',
            resource: p,
            property: 'state',
            to: 'removed',
          })),
        );
        return;
      }
      await sh(`apk del ${present.map($_).join(' ')}`);
      emitApkChanges(diffVersionSnapshots(before, await getInstalledPackages()));
    },
    {
      details: () => ({
        packages: packages.join(' '),
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
function emitApkChanges(changes: VersionChanges): void {
  const entries = [
    ...changes.updated.map((p) => ({ type: 'apk', resource: p, property: 'state', to: 'updated' })),
    ...changes.installed.map((p) => ({
      type: 'apk',
      resource: p,
      property: 'state',
      to: 'installed',
    })),
    ...changes.removed.map((p) => ({ type: 'apk', resource: p, property: 'state', to: 'removed' })),
  ];
  if (entries.length > 0) {
    emitChanged(entries);
  }
}

/** Options for updating packages with apk. */
export interface UpdatePackagesOptions {
  /**
   * Package names to update. Omitted or empty means a full system upgrade
   * (`apk upgrade` with no package arguments).
   */
  readonly packages?: string[];
}

/** Packages changed by an update transaction, grouped by change kind. */
export interface UpdatePackagesResult {
  /** Packages updated in place. */
  readonly updated: string[];
  /** Newly installed packages (dependencies pulled in by the upgrade). */
  readonly installed: string[];
  /** Packages removed by the transaction. */
  readonly removed: string[];
}

/**
 * Parses `apk list --upgradable` output into installed names with available
 * upgrades.
 *
 * Each row starts with a `name-version` token (`nano-9.3-r0 ...`), which
 * cannot be split reliably (names may contain dashes followed by digits,
 * e.g. `jshn-...`, and spaces, e.g. `apk-mbedtls`). Instead every token
 * is matched against installed names, longest first: `list --upgradable`
 * only reports upgrades for installed packages, so the longest installed
 * name that prefixes the token (plus `-`) is exactly the upgraded package.
 * Unmatched lines (warnings, blank rows) are skipped, as is empty output.
 */
export function parseApkUpgradable(installedNames: readonly string[], stdout: string): string[] {
  const byLength = [...installedNames].sort((a, b) => b.length - a.length);
  const names = new Set<string>();
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const token = trimmed.split(/\s+/, 1)[0]!;
    const match = byLength.find((n) => token === n || token.startsWith(`${n}-`));
    if (match !== void 0) {
      names.add(match);
    }
  }
  return [...names].sort();
}

/**
 * Updates packages using apk.
 *
 * Refreshes the package indexes (`apk update`) first, then with no
 * `packages` (or an empty list) upgrades the whole system; otherwise
 * upgrades only the named packages (plus needed dependencies). Returns the
 * changed package names grouped by change kind and emits a change event per
 * group. Real transactions are detected by diffing installed-database
 * snapshots. Dry-run previews list upgradable packages via
 * `apk list --upgradable` (matched against installed names, no version
 * parsing) and map them against the scope; newly installed dependencies
 * and removals need the solver transaction and are not predicted.
 */
export async function updatePackages(
  options?: UpdatePackagesOptions,
): Promise<UpdatePackagesResult> {
  const packages = options?.packages;
  return task(
    'apk upgrade',
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
      await sh('apk update');
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { stdout } = await sh('apk list --upgradable');
        const changes = splitListedUpgrades(
          parseApkUpgradable(
            before.map((p) => p.name),
            stdout,
          ),
          new Set(before.map((p) => p.name)),
          scoped ? packages : void 0,
        );
        emitApkChanges(changes);
        return changes;
      }
      if (Array.isArray(packages) && packages.length > 0) {
        await sh(`apk upgrade ${packages.map($_).join(' ')}`);
      } else {
        await sh('apk upgrade');
      }
      const changes = diffVersionSnapshots(before, await getInstalledPackages());
      emitApkChanges(changes);
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
