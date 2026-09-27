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

/**
 * DNF4 main configuration ([main] section of /etc/dnf/dnf.conf).
 *
 * All options correspond to keys in the [main] section, including options
 * shared with repository sections (used as per-repo defaults).
 * All fields are optional and INI-verbatim: booleans use the existing
 * `'0' | '1' | 'True' | 'False'` style, lists/integers/sizes/times/colors
 * are plain strings.
 *
 * @see dnf.conf(5) - DNF4 configuration file format
 */
export type DnfMainConf = {
  readonly allow_vendor_change?: '0' | '1' | 'True' | 'False';
  readonly arch?: string;
  readonly assumeno?: '0' | '1' | 'True' | 'False';
  readonly assumeyes?: '0' | '1' | 'True' | 'False';
  readonly autocheck_running_kernel?: '0' | '1' | 'True' | 'False';
  readonly basearch?: string;
  readonly best?: '0' | '1' | 'True' | 'False';
  readonly cachedir?: string;
  readonly cacheonly?: '0' | '1' | 'True' | 'False';
  readonly check_config_file_age?: '0' | '1' | 'True' | 'False';
  readonly clean_requirements_on_remove?: '0' | '1' | 'True' | 'False';
  readonly config_file_path?: string;
  readonly debuglevel?: string;
  readonly debug_solver?: '0' | '1' | 'True' | 'False';
  readonly defaultyes?: '0' | '1' | 'True' | 'False';
  readonly diskspacecheck?: '0' | '1' | 'True' | 'False';
  readonly errorlevel?: string;
  readonly exclude_from_weak?: string;
  readonly exclude_from_weak_autodetect?: '0' | '1' | 'True' | 'False';
  readonly exit_on_lock?: '0' | '1' | 'True' | 'False';
  readonly gpgkey_dns_verification?: '0' | '1' | 'True' | 'False';
  readonly group_package_types?: string;
  readonly ignorearch?: '0' | '1' | 'True' | 'False';
  readonly installonlypkgs?: string;
  readonly installonly_limit?: string;
  readonly installroot?: string;
  readonly install_weak_deps?: '0' | '1' | 'True' | 'False';
  readonly keepcache?: '0' | '1' | 'True' | 'False';
  readonly logdir?: string;
  readonly logfilelevel?: string;
  readonly log_compress?: '0' | '1' | 'True' | 'False';
  readonly log_rotate?: string;
  readonly log_size?: string;
  readonly metadata_timer_sync?: string;
  readonly module_obsoletes?: '0' | '1' | 'True' | 'False';
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
  readonly releasever?: string;
  readonly reposdir?: string;
  readonly rpmverbosity?: 'critical' | 'emergency' | 'error' | 'warn' | 'info' | 'debug';
  readonly strict?: '0' | '1' | 'True' | 'False';
  readonly tsflags?: string;
  readonly upgrade_group_objects_upgrade?: '0' | '1' | 'True' | 'False';
  readonly usr_drift_protected_paths?: string;
  readonly varsdir?: string;
  readonly zchunk?: '0' | '1' | 'True' | 'False';
  readonly color?: 'auto' | 'never' | 'always';
  readonly color_list_available_downgrade?: string;
  readonly color_list_available_install?: string;
  readonly color_list_available_reinstall?: string;
  readonly color_list_available_upgrade?: string;
  readonly color_list_installed_extra?: string;
  readonly color_list_installed_newer?: string;
  readonly color_list_installed_older?: string;
  readonly color_list_installed_reinstall?: string;
  readonly color_search_match?: string;
  readonly color_update_installed?: string;
  readonly color_update_local?: string;
  readonly color_update_remote?: string;
  readonly bandwidth?: string;
  readonly countme?: '0' | '1' | 'True' | 'False';
  readonly deltarpm?: '0' | '1' | 'True' | 'False';
  readonly deltarpm_percentage?: string;
  readonly enablegroups?: '0' | '1' | 'True' | 'False';
  readonly excludepkgs?: string;
  readonly fastestmirror?: '0' | '1' | 'True' | 'False';
  readonly gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly includepkgs?: string;
  readonly ip_resolve?: '4' | 'IPv4' | '6' | 'IPv6';
  readonly localpkg_gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly max_parallel_downloads?: string;
  readonly metadata_expire?: string;
  readonly minrate?: string;
  readonly password?: string;
  readonly proxy?: string;
  readonly proxy_username?: string;
  readonly proxy_password?: string;
  readonly proxy_auth_method?: 'basic' | 'digest' | 'negotiate' | 'ntlm' | 'digest_ie' | 'ntlm_wb' | 'none' | 'any';
  readonly proxy_sslcacert?: string;
  readonly proxy_sslverify?: '0' | '1' | 'True' | 'False';
  readonly proxy_sslclientcert?: string;
  readonly proxy_sslclientkey?: string;
  readonly repo_gpgcheck?: '0' | '1' | 'True' | 'False';
  readonly retries?: string;
  readonly skip_if_unavailable?: '0' | '1' | 'True' | 'False';
  readonly sslcacert?: string;
  readonly sslverify?: '0' | '1' | 'True' | 'False';
  readonly sslverifystatus?: '0' | '1' | 'True' | 'False';
  readonly sslclientcert?: string;
  readonly sslclientkey?: string;
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
