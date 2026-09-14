/**
 * @module pkg/dnf4
 *
 * DNF4 package and repository management for RHEL-based systems.
 *
 * DNF4 (Python-based Dandified YUM) is the package manager for RHEL 8/9/10,
 * CentOS Stream, and their derivatives. It uses libsolv for dependency
 * resolution.
 *
 * @see installDnfPackages(8) - DNF4 package manager
 * @see installDnfPackages.conf(5) - DNF4 configuration file format
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

/** DNF4 repository configuration in INI format (.repo files). */
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

/** Options for installing packages with DNF4. */
export interface InstallPackagesOptions {
  /** Package names to install. */
  readonly packages: string[];
  /** Whether to install weak dependencies (defaults to false). */
  readonly weakDependencies?: boolean;
}

/**
 * Installs packages using DNF4.
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
            type: 'dnf4',
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

/** Options for removing packages with DNF4. */
export interface RemovePackagesOptions {
  /** Package names to remove. */
  readonly packages: string[];
}

/**
 * Removes packages using DNF4.
 *
 * Unused dependencies installed for the removed packages are removed as
 * well (DNF4 cleans requirements on remove by default). Emits change events
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
            type: 'dnf4',
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
 * Matches the "Installed:" section in DNF4 output.
 */
const INSTALLING_RE = /Installed:\n([\s\S]*?)(?=\n\S|$)/g;
/**
 * Matches the "Removed:" section in DNF4 output.
 */
const REMOVING_RE = /Removed:\n([\s\S]*?)(?=\n\S|$)/g;

/**
 * Parses the compact single-NEVRA-column tables from DNF4 output to find
 * packages.
 *
 * Collects every matching section. Each row packs several NEVRAs per line
 * (`jq-1.7.1-11.el10_2.2.x86_64 oniguruma-6.9.9-7.el10.x86_64`).
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
      for (const col of trimmed.split(/\s+/)) {
        const name = _parseNevraName(col);
        if (name) {
          packages.push(name);
        }
      }
    }
  }

  return packages;
}

/**
 * Extracts the package name from a NEVRA string (`name-version-release.arch`).
 *
 * The name runs up to the first dash followed by a digit; an optional
 * leading `epoch:` is stripped.
 */
function _parseNevraName(nevra: string): string | undefined {
  const withoutEpoch = nevra.replace(/^\d+:/, '');
  const dot = withoutEpoch.lastIndexOf('.');
  const withoutArch = dot === -1 ? withoutEpoch : withoutEpoch.slice(0, dot);
  for (let i = 0; i < withoutArch.length; i++) {
    if (withoutArch[i] === '-' && i + 1 < withoutArch.length && /\d/.test(withoutArch[i + 1]!)) {
      return withoutArch.slice(0, i) || undefined;
    }
  }
  return undefined;
}
