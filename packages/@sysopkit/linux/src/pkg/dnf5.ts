/**
 * @module pkg/dnf5
 *
 * DNF5 package and repository management for Fedora and compatible systems.
 *
 * DNF5 is the package manager for Fedora 41+ and recent RHEL/CentOS Stream
 * releases. It replaces DNF4 (Python-based) with a C++ implementation using
 * libsolv for dependency resolution.
 *
 * @see installDnfPackages(8) - DNF5 package manager
 * @see installDnfPackages.conf(5) - DNF5 configuration file format
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

/** DNF5 repository configuration in INI format (.repo files). */
export type DnfRepoConf = {
  [id: string]: DnfRepoConfEntry;
};

export type DnfRepoConfEntry = {
  readonly name: string;
  readonly enabled: '0' | '1' | 'True' | 'False';
  readonly skip_if_unavailable?: '0' | '1' | 'True' | 'False';
  readonly baseurl?: string;
  readonly metalink?: string;
  readonly mirrorlist?: string;
  readonly gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly gpgkey?: string;
  readonly exclude?: string;
  readonly includepkgs?: string;
};

/** Detailed information about an installed package. */
export interface PackageInfo {
  readonly name: string;
  readonly epoch: string;
  readonly version: string;
  readonly release: string;
  readonly arch: string;
}

/**
 * Lists all installed packages with detailed metadata.
 *
 * Uses `dnf repoquery --installed` to query the RPM database and extract
 * name, epoch, version, release, and architecture for each package.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh(
    `dnf repoquery --installed --qf '%{name} %{epoch} %{version} %{release} %{arch}\n'`,
  );
  return stdout
    .trim()
    .split('\n')
    .map((e) => {
      const parts = e.split(' ');
      return {
        name: parts[0],
        epoch: parts[1],
        version: parts[2],
        release: parts[3],
        arch: parts[4],
      };
    });
}

/** Options for installing packages with DNF5. */
export interface InstallPackagesOptions {
  /** Package names to install. */
  readonly packages: string[];
  /** Whether to install weak dependencies (defaults to false). */
  readonly weakDependencies?: boolean;
}

/**
 * Installs packages using DNF5.
 *
 * Emits change events for packages that are newly installed. In dry-run mode,
 * uses `--assumeno` to preview changes without applying them.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages, weakDependencies = false } = options;
  return task(
    'dnf install',
    async (ctx) => {
      const { stdout } = await sh(
        `LANG=en_US.UTF-8 dnf install -q${ctx.dryRun ? ' --assumeno' : ' -y'} --setopt=install_weak_deps=${weakDependencies ? 'True' : 'False'} ${packages.map($_).join(' ')}`,
      );
      const pkgs = _parseTable(stdout, INSTALLING_RE);
      if (pkgs.length > 0) {
        emitChanged(
          pkgs.map((p) => ({
            type: 'dnf5',
            resource: p,
            property: 'state',
            to: 'installed',
          })),
        );
      }
    },
    {
      details: () => ({
        'packages': packages.join(' '),
        'weak dependencies': weakDependencies === void 0 ? void 0 : weakDependencies ? 'on' : 'off',
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/** Options for removing packages with DNF5. */
export interface RemovePackagesOptions {
  /** Package names to remove. */
  readonly packages: string[];
}

/**
 * Removes packages using DNF5.
 *
 * Unused dependencies installed for the removed packages are removed as
 * well (DNF5 cleans requirements on remove by default). Emits change events
 * for packages that are removed.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'dnf remove',
    async (ctx) => {
      const { stdout } = await sh(
        `LANG=en_US.UTF-8 dnf remove -q ${ctx.dryRun ? ' --assumeno' : ' -y'} ${packages.map($_).join(' ')}`,
      );
      const pkgs = _parseTable(stdout, REMOVING_RE);
      if (pkgs.length > 0) {
        emitChanged(
          pkgs.map((p) => ({
            type: 'dnf5',
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

/**
 * Matches the "Installing:" section in DNF5 output, including the
 * "Installing dependencies:" subsection (DNF5 lists dependencies separately
 * from explicitly requested packages).
 */
const INSTALLING_RE = /Installing(?: dependencies)?:\n([\s\S]*?)(?=\n\S|$)/g;
/**
 * Matches the "Removing:" section in DNF5 output, including the
 * "Removing unused dependencies:" subsection (unused dependencies are
 * cleaned on remove by default).
 */
const REMOVING_RE = /Removing(?: unused dependencies)?:\n([\s\S]*?)(?=\n\S|$)/g;

/**
 * Parses the multi-column tables from DNF5 output to find packages.
 *
 * Collects every matching section (DNF5 prints dependencies under separate
 * "Installing dependencies:" / "Removing unused dependencies:" headers).
 * Each row has the form
 * (`ed x86_64 0:1.22.5-2.fc44 fedora 149.7 KiB`) where the first column is
 * the package name.
 */
function _parseTable(output: string, re: RegExp): string[] {
  const packages: string[] = [];

  for (const match of output.matchAll(re)) {
    const body = match[1];
    if (!body) {
      continue;
    }
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const cols = trimmed.split(/\s+/);
      if (cols[0]) {
        packages.push(cols[0]);
      }
    }
  }

  return packages;
}
