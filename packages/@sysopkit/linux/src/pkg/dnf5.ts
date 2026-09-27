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

/**
 * DNF5 main configuration ([main] section of /etc/dnf/dnf.conf).
 *
 * All options correspond to keys in the [main] section, including options
 * shared with repository sections (used as per-repo defaults).
 * All fields are optional and INI-verbatim: booleans use the existing
 * `'0' | '1' | 'True' | 'False'` style, lists/integers/sizes/times/colors
 * are plain strings.
 *
 * @see dnf.conf(5) - DNF5 configuration file format
 */
export type DnfMainConf = {
  readonly allow_downgrade?: '0' | '1' | 'True' | 'False';
  readonly allow_vendor_change?: '0' | '1' | 'True' | 'False';
  readonly assumeno?: '0' | '1' | 'True' | 'False';
  readonly assumeyes?: '0' | '1' | 'True' | 'False';
  readonly best?: '0' | '1' | 'True' | 'False';
  readonly cachedir?: string;
  readonly cacheonly?: 'all' | 'metadata' | 'none';
  readonly check_config_file_age?: '0' | '1' | 'True' | 'False';
  readonly clean_requirements_on_remove?: '0' | '1' | 'True' | 'False';
  readonly debugdir?: string;
  readonly debug_solver?: '0' | '1' | 'True' | 'False';
  readonly defaultyes?: '0' | '1' | 'True' | 'False';
  readonly destdir?: string;
  readonly exclude_from_weak?: string;
  readonly exclude_from_weak_autodetect?: '0' | '1' | 'True' | 'False';
  readonly excludeenvs?: string;
  readonly excludegroups?: string;
  readonly gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly gpgcheck_policy?: 'legacy' | 'full' | 'all';
  readonly group_package_types?: string;
  readonly ignorearch?: '0' | '1' | 'True' | 'False';
  readonly installonlypkgs?: string;
  readonly installonly_limit?: string;
  readonly installroot?: string;
  readonly install_weak_deps?: '0' | '1' | 'True' | 'False';
  readonly keepcache?: '0' | '1' | 'True' | 'False';
  readonly logdir?: string;
  readonly log_rotate?: string;
  readonly log_size?: string;
  readonly module_platform_id?: string;
  readonly module_stream_switch?: '0' | '1' | 'True' | 'False';
  readonly multilib_policy?: 'best' | 'all';
  readonly obsoletes?: '0' | '1' | 'True' | 'False';
  readonly optional_metadata_types?: string;
  readonly persistdir?: string;
  readonly persistence?: 'auto' | 'transient' | 'persist';
  readonly pluginconfpath?: string;
  readonly pluginpath?: string;
  readonly plugins?: '0' | '1' | 'True' | 'False';
  readonly protected_packages?: string;
  readonly protect_running_kernel?: '0' | '1' | 'True' | 'False';
  readonly recent?: string;
  readonly reposdir?: string;
  readonly skip_broken?: '0' | '1' | 'True' | 'False';
  readonly skip_system_repo_lock?: '0' | '1' | 'True' | 'False';
  readonly skip_unavailable?: '0' | '1' | 'True' | 'False';
  readonly system_cachedir?: string;
  readonly system_state_dir?: string;
  readonly transaction_history_dir?: string;
  readonly tsflags?: string;
  readonly use_host_config?: '0' | '1' | 'True' | 'False';
  readonly usr_drift_protected_paths?: string;
  readonly varsdir?: string;
  readonly zchunk?: '0' | '1' | 'True' | 'False';
  readonly color_list_available_upgrade?: string;
  readonly color_list_available_downgrade?: string;
  readonly color_list_available_reinstall?: string;
  readonly color_list_available_install?: string;
  readonly color_update_installed?: string;
  readonly color_update_local?: string;
  readonly color_update_remote?: string;
  readonly color_search_match?: string;
  readonly bandwidth?: string;
  readonly build_cache?: '0' | '1' | 'True' | 'False';
  readonly countme?: '0' | '1' | 'True' | 'False';
  readonly disable_excludes?: string;
  readonly enablegroups?: '0' | '1' | 'True' | 'False';
  readonly excludepkgs?: string;
  readonly fastestmirror?: '0' | '1' | 'True' | 'False';
  readonly pkg_gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly includepkgs?: string;
  readonly ip_resolve?: '4' | 'IPv4' | '6' | 'IPv6' | 'whatever';
  readonly localpkg_gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly max_parallel_downloads?: string;
  readonly max_downloads_per_mirror?: string;
  readonly metadata_expire?: string;
  readonly minrate?: string;
  readonly password?: string;
  readonly proxy?: string;
  readonly proxy_username?: string;
  readonly proxy_password?: string;
  readonly proxy_auth_method?:
    | 'basic'
    | 'digest'
    | 'negotiate'
    | 'ntlm'
    | 'digest_ie'
    | 'ntlm_wb'
    | 'none'
    | 'any';
  readonly proxy_sslcacert?: string;
  readonly proxy_sslclientcert?: string;
  readonly proxy_sslclientkey?: string;
  readonly proxy_sslverify?: '0' | '1' | 'True' | 'False';
  readonly repo_gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly skip_if_unavailable?: '0' | '1' | 'True' | 'False';
  readonly sslcacert?: string;
  readonly sslclientcert?: string;
  readonly sslclientkey?: string;
  readonly sslverify?: '0' | '1' | 'True' | 'False';
  readonly throttle?: string;
  readonly timeout?: string;
  readonly username?: string;
  readonly user_agent?: string;
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
