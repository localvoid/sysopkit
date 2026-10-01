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

import {
  diffPackages,
  parseInstalledPackages,
  parseInstallonlyNames,
  splitByPresence,
  splitUpgradeCandidates,
  type DnfChanges,
} from './dnf-common.js';

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
 * Queries the local RPM database directly (`rpm -qa`), so no repository
 * metadata is loaded and the query works offline.
 */
export async function getInstalledPackages(): Promise<PackageInfo[]> {
  const { stdout } = await sh(
    `rpm -qa --queryformat '%{NAME} %{EPOCH} %{VERSION} %{RELEASE} %{ARCH}\\n'`,
  );
  return parseInstalledPackages(stdout);
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
 * Change detection diffs RPM database snapshots taken before and after the
 * transaction, so installed dependencies and upgraded/obsoleted packages are
 * reported too. Dry-run previews compare the requested names against the
 * snapshot without running the solver: names absent from the snapshot are
 * reported as installed. Solver-resolved dependencies are not enumerated in
 * previews, and names are not validated against repositories.
 */
export async function installPackages(options: InstallPackagesOptions): Promise<void> {
  const { packages, weakDependencies = false } = options;
  return task(
    'dnf install',
    async (ctx) => {
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { absent } = splitByPresence(before, packages);
        if (absent.length > 0) {
          emitChanged(
            absent.map((p) => ({
              type: 'dnf4',
              resource: p,
              property: 'state',
              to: 'installed',
            })),
          );
        }
        return;
      }
      await sh(
        `dnf install -y --setopt=install_weak_deps=${weakDependencies ? 'True' : 'False'} ${packages.map($_).join(' ')}`,
      );
      emitDnfChanges('dnf4', diffPackages(before, await getInstalledPackages()));
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
 * well (DNF4 cleans requirements on remove by default). Change detection
 * diffs RPM database snapshots taken before and after the transaction.
 * Dry-run previews compare the requested names against the snapshot without
 * running the solver: names present in the snapshot are reported as removed.
 * Autoremoved dependencies are not enumerated in previews, and names are not
 * validated against repositories.
 */
export async function removePackages(options: RemovePackagesOptions): Promise<void> {
  const { packages } = options;
  return task(
    'dnf remove',
    async (ctx) => {
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { present } = splitByPresence(before, packages);
        if (present.length > 0) {
          emitChanged(
            present.map((p) => ({
              type: 'dnf4',
              resource: p,
              property: 'state',
              to: 'removed',
            })),
          );
        }
        return;
      }
      await sh(`dnf remove -y ${packages.map($_).join(' ')}`);
      emitDnfChanges('dnf4', diffPackages(before, await getInstalledPackages()));
    },
    {
      details: () => ({
        packages: packages.join(' '),
      }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/** Options for updating packages with DNF4. */
export interface UpdatePackagesOptions {
  /**
   * Package names to update. Omitted or empty means a full system upgrade
   * (`dnf upgrade` with no package arguments).
   */
  readonly packages?: string[];
}

/** Packages changed by an update transaction, grouped by change kind. */
export interface UpdatePackagesResult {
  /** Packages updated in place (`Upgraded:` section). */
  readonly updated: string[];
  /**
   * Newly installed packages (`Installed:` section). Kernels are
   * installonly, so a kernel update lands here rather than under updated.
   */
  readonly installed: string[];
  /** Packages removed by the transaction (`Removed:` section, e.g. obsoleted). */
  readonly removed: string[];
}

/**
 * Updates packages using DNF4.
 *
 * With no `packages` (or an empty list) upgrades the whole system
 * (`dnf upgrade`); otherwise upgrades only the named packages. Returns the
 * changed package names grouped by change kind so callers can decide
 * directly (e.g. reboot when `kernel*`, `glibc*`, or `systemd*` were
 * touched) instead of re-deriving it. Emits change events per group
 * (`updated` / `installed` / `removed`). Real transactions are detected by
 * diffing RPM database snapshots. Dry-run previews list available upgrades
 * via `repoquery --upgrades` (structured `--queryformat` output, no table
 * parsing) and map them against the snapshot; obsoleted removals need the
 * solver transaction and are not predicted.
 */
export async function updatePackages(
  options?: UpdatePackagesOptions,
): Promise<UpdatePackagesResult> {
  const packages = options?.packages;
  return task(
    'dnf upgrade',
    async (ctx) => {
      if (packages !== void 0) {
        if (
          !Array.isArray(packages) ||
          packages.some((p) => typeof p !== 'string' || p.length === 0)
        ) {
          throw new Error('packages must be an array of package names when provided');
        }
      }
      const scope = packages && packages.length > 0 ? ` ${packages.map($_).join(' ')}` : '';
      const before = await getInstalledPackages();
      if (ctx.dryRun) {
        const { stdout } = await sh(
          `dnf repoquery --upgrades --latest-limit 1 --queryformat '%{NAME} %{EPOCH} %{VERSION} %{RELEASE} %{ARCH}\\n'${scope}`,
        );
        const candidates = parseInstalledPackages(stdout);
        if (candidates.length === 0) {
          return { updated: [], installed: [], removed: [] };
        }
        const { stdout: installonlyStdout } = await sh(
          `dnf repoquery --installonly --queryformat '%{NAME}\\n'`,
        );
        const changes = splitUpgradeCandidates(
          before,
          candidates,
          new Set(parseInstallonlyNames(installonlyStdout)),
        );
        emitDnfChanges('dnf4', changes);
        return changes;
      }
      await sh(`dnf upgrade -y${scope}`);
      const changes = diffPackages(before, await getInstalledPackages());
      emitDnfChanges('dnf4', changes);
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

/**
 * Emits one change entry per changed package, grouped by change kind.
 *
 * Shared by snapshot-diff and preview paths so both report the same event
 * shape.
 */
function emitDnfChanges(type: 'dnf4', changes: DnfChanges): void {
  const entries = [
    ...changes.updated.map((p) => ({ type, resource: p, property: 'state', to: 'updated' })),
    ...changes.installed.map((p) => ({ type, resource: p, property: 'state', to: 'installed' })),
    ...changes.removed.map((p) => ({ type, resource: p, property: 'state', to: 'removed' })),
  ];
  if (entries.length > 0) {
    emitChanged(entries);
  }
}
