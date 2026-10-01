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

import { diffVersionSnapshots, splitByPresence, type VersionChanges } from './snap-diff.js';

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
