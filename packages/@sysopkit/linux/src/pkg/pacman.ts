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

/** Information about an installed package. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * Lists all installed packages on the system.
 *
 * Uses `pacman -Q` to enumerate explicitly and implicitly installed
 * packages from the local database.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh('pacman -Q');
  if (stdout.length > 0) {
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
  return [];
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
 * no-op. Emits change events for packages that are newly installed or
 * upgraded. In dry-run mode, uses `-p` (print-only) to preview which
 * packages would change without applying them.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'pacman install',
    async (ctx) => {
      const { stdout } = await sh(
        ctx.dryRun
          ? `LANG=en_US.UTF-8 pacman -Syp --needed --print-format '%n' ${packages.map($_).join(' ')}`
          : `LANG=en_US.UTF-8 pacman -Sy --needed --noconfirm ${packages.map($_).join(' ')}`,
      );
      const pkgs = ctx.dryRun
        ? _parsePreview(stdout, packages)
        : _parseTransaction(stdout, INSTALLING_LINE_RE);
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
 * Emits change events for packages that are removed. Dependencies pulled in
 * for the removed packages are left behind unless `autoremove` is set
 * (matching `apt-get remove` semantics); use `-Rns` manually when recursive
 * removal including configuration files is wanted. In dry-run mode, uses
 * `-p` (print-only) to preview which packages would be removed without
 * applying the change.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages, autoremove = false } = options;
  return task(
    'pacman remove',
    async (ctx) => {
      const recursive = autoremove ? 's' : '';
      const { stdout } = await sh(
        ctx.dryRun
          ? `LANG=en_US.UTF-8 pacman -R${recursive}p --print-format '%n' ${packages.map($_).join(' ')}`
          : `LANG=en_US.UTF-8 pacman -R${recursive} --noconfirm ${packages.map($_).join(' ')}`,
      );
      const pkgs = ctx.dryRun
        ? _parsePreview(stdout, packages)
        : _parseTransaction(stdout, REMOVING_LINE_RE);
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

/** Matches install progress lines (`installing ed...`, `upgrading ed...`). */
const INSTALLING_LINE_RE = /^(?:install|upgrad|downgrad|reinstall)ing (\S+)\.\.\.$/;
/** Matches removal progress lines (`removing ed...`). */
const REMOVING_LINE_RE = /^removing (\S+)\.\.\.$/;

/**
 * Parses transaction progress lines from pacman output to find changed
 * packages.
 */
function _parseTransaction(output: string, re: RegExp): string[] {
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
