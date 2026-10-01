/**
 * @module pkg/pacman
 *
 * Pacman package management for Arch Linux-based systems.
 *
 * Pacman is the package manager for Arch Linux and its derivatives. This
 * module provides operations for package management.
 *
 * @see pacman(8) - package manager utility
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

import { diffVersionSnapshots, splitListedUpgrades, type VersionChanges } from './snap-diff.js';

/** Information about an installed package. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * Parses `pacman -Q` output into package metadata.
 *
 * One `name version` pair per line; versions contain no whitespace.
 * Blank lines are skipped; empty output yields `[]`.
 */
export function parsePacmanList(stdout: string): PackageInfo[] {
  if (stdout.trim().length === 0) {
    return [];
  }
  return stdout
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name, ...rest] = line.split(/\s+/);
      return {
        name: name!,
        version: rest.join(' '),
      };
    });
}

/**
 * Lists all installed packages on the system.
 *
 * Uses `pacman -Q` to enumerate explicitly and implicitly installed
 * packages from the local database.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh('pacman -Q');
  return parsePacmanList(stdout);
}

/** Options for installing packages with pacman. */
export interface InstallPackagesOptions {
  /** Package names to install. */
  readonly packages: string[];
}

/**
 * Installs packages using pacman.
 *
 * Refreshes the package databases (`-Sy`) as part of the install and skips
 * packages that are already up to date (`--needed`), so re-running is a
 * no-op. Change detection diffs local-database snapshots taken before and
 * after the transaction, so installed dependencies and upgraded packages
 * are reported too. In dry-run mode, uses `-p` (print-only) to preview
 * which requested packages would change without applying them.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'pacman install',
    async (ctx) => {
      if (ctx.dryRun) {
        const { stdout } = await sh(
          `pacman -Syp --needed --print-format '%n' ${packages.map($_).join(' ')}`,
        );
        const pkgs = _parsePreview(stdout, packages);
        if (pkgs.length > 0) {
          emitChanged(
            pkgs.map((p) => ({
              type: 'pacman',
              resource: p,
              property: 'state',
              to: 'installed',
            })),
          );
        }
        return;
      }
      const before = await getInstalledPackages();
      await sh(`pacman -Sy --needed --noconfirm ${packages.map($_).join(' ')}`);
      emitPacmanChanges(diffVersionSnapshots(before, await getInstalledPackages()));
    },
    {
      details: () => ({
        packages: packages.join(' '),
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/** Options for removing packages with pacman. */
export interface RemovePackagesOptions {
  /** Package names to remove. */
  readonly packages: string[];
  /**
   * Remove dependencies that were installed for these packages and are no
   * longer needed (`-Rs`, recursive). Defaults to false.
   */
  readonly autoremove?: boolean;
}

/**
 * Removes packages using pacman.
 *
 * **[IDEMPOTENT]** Missing packages are skipped (pacman exits non-zero for
 * `target not found`, so re-running for absent packages is a no-op without
 * throwing). Emits change events for packages that are removed. Dependencies
 * pulled in for the removed packages are left behind unless `autoremove` is
 * set (matching `apt-get remove` semantics); use `-Rns` manually when
 * recursive removal including configuration files is wanted. In dry-run
 * mode, uses `-p` (print-only) to preview which packages would be removed
 * without applying the change.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages, autoremove = false } = options;
  return task(
    'pacman remove',
    async (ctx) => {
      const before = await getInstalledPackages();
      const installed = new Set(before.map((p) => p.name));
      const targets = packages.filter((p) => installed.has(p));
      if (targets.length === 0) {
        return;
      }
      const recursive = autoremove ? 's' : '';
      if (ctx.dryRun) {
        const { stdout } = await sh(
          `pacman -R${recursive}p --print-format '%n' ${targets.map($_).join(' ')}`,
        );
        const pkgs = _parsePreview(stdout, targets);
        if (pkgs.length > 0) {
          emitChanged(
            pkgs.map((p) => ({
              type: 'pacman',
              resource: p,
              property: 'state',
              to: 'removed',
            })),
          );
        }
        return;
      }
      await sh(`pacman -R${recursive} --noconfirm ${targets.map($_).join(' ')}`);
      emitPacmanChanges(diffVersionSnapshots(before, await getInstalledPackages()));
    },
    {
      details: () => ({
        packages: packages.join(' '),
        autoremove: autoremove === void 0 ? void 0 : autoremove ? 'on' : 'off',
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/**
 * Emits one change entry per changed package, grouped by change kind.
 *
 * Used for snapshot-diff paths; dry-run print-only previews keep their own
 * requested-set reporting.
 */
function emitPacmanChanges(changes: VersionChanges): void {
  const entries = [
    ...changes.updated.map((p) => ({
      type: 'pacman',
      resource: p,
      property: 'state',
      to: 'updated',
    })),
    ...changes.installed.map((p) => ({
      type: 'pacman',
      resource: p,
      property: 'state',
      to: 'installed',
    })),
    ...changes.removed.map((p) => ({
      type: 'pacman',
      resource: p,
      property: 'state',
      to: 'removed',
    })),
  ];
  if (entries.length > 0) {
    emitChanged(entries);
  }
}

/**
 * Parses print-only (`-p --print-format '%n'`) preview output.
 *
 * The preview shares stdout with progress noise (`:: Synchronizing...`,
 * `<repo> downloading...`), so only lines naming a requested package count.
 */
function _parsePreview(output: string, requested: string[]): string[] {
  const wanted = new Set(requested);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && wanted.has(line));
}

/** Options for updating packages with pacman. */
export interface UpdatePackagesOptions {
  /**
   * Package names to update. Omitted or empty means a full system upgrade
   * (`pacman -Syu`). Scoped updates refresh the databases and upgrade only
   * installed requested packages (`pacman -Sy --needed`); missing names are
   * skipped, never installed.
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
 * Parses `pacman -Qu` output into names with available upgrades.
 *
 * Each row starts with the package name (`name oldver -> newver`); only
 * that token is read. Blank lines are skipped, as is empty output (no
 * upgrades available).
 */
export function parsePacmanUpgradable(stdout: string): string[] {
  const names: string[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const name = trimmed.split(/\s+/, 1)[0]!;
    if (name.length > 0) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Updates packages using pacman.
 *
 * With no `packages` (or an empty list) upgrades the whole system
 * (`pacman -Syu`, databases refreshed as part of the run); otherwise
 * refreshes the databases and upgrades only the requested packages that
 * are already installed (`pacman -Sy --needed`, missing names skipped).
 * Returns the changed package names grouped by change kind and emits a
 * change event per group. Real transactions are detected by diffing
 * local-database snapshots. Dry-run previews sync the databases and list
 * available upgrades via `pacman -Qu` (first-token parsing, no progress
 * parsing) mapped against the snapshot and scope; newly installed
 * dependencies and removals need the solver transaction and are not
 * predicted.
 */
export async function updatePackages(
  options?: UpdatePackagesOptions,
): Promise<UpdatePackagesResult> {
  const packages = options?.packages;
  return task(
    'pacman upgrade',
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
      const before = await getInstalledPackages();
      const installedNames = new Set(before.map((p) => p.name));
      if (ctx.dryRun) {
        await sh('pacman -Sy');
        const { stdout } = await sh('pacman -Qu');
        const changes = splitListedUpgrades(
          parsePacmanUpgradable(stdout),
          installedNames,
          scoped ? packages : void 0,
        );
        emitPacmanChanges(changes);
        return changes;
      }
      if (Array.isArray(packages) && packages.length > 0) {
        const targets = packages.filter((p) => installedNames.has(p));
        if (targets.length === 0) {
          return { updated: [], installed: [], removed: [] };
        }
        await sh(`pacman -Sy --needed --noconfirm ${targets.map($_).join(' ')}`);
      } else {
        await sh('pacman -Syu --noconfirm');
      }
      const changes = diffVersionSnapshots(before, await getInstalledPackages());
      emitPacmanChanges(changes);
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
