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

import { diffVersionSnapshots, type VersionChanges } from './snap-diff.js';

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
