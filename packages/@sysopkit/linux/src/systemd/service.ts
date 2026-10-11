/**
 * @module systemd/service
 *
 * Service management operations for systemd.
 *
 * @see systemctl(1) - Control the systemd system and service manager
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

import { parseKeyValue, type SystemdScope, type SystemdScopeOptions } from './common.js';

export interface ServiceInfo {
  readonly LoadState: string;
  readonly ActiveState: string;
  readonly SubState: string;
  readonly UnitFileState: string;
  readonly MainPID: number;
}

export interface GetServiceInfoOptions extends SystemdScopeOptions {
  readonly name: string;
}

export async function getServiceInfo(options: GetServiceInfoOptions): Promise<ServiceInfo> {
  const { name, scope } = options;

  let cmd = `systemctl --no-pager`;
  if (scope === 'user') cmd += ' --user';
  cmd += ` show ${$_(name)} --property=LoadState,ActiveState,SubState,UnitFileState,MainPID`;
  const { stdout } = await sh(cmd);
  return parseKeyValue(stdout) as unknown as ServiceInfo;
}

export interface ServiceOptions extends SystemdScopeOptions {
  readonly name: string | readonly string[];
}

function _names(name: string | readonly string[]): string[] {
  return typeof name === 'string' ? [name] : [...name];
}

function _checkNames(names: string[]): void {
  if (names.length === 0) throw new Error('refusing: unit name is required');
  for (const n of names) {
    if (n.length === 0) {
      throw new Error(`refusing: bad unit name '${n}'`);
    }
  }
}

function _label(name: string | readonly string[]): string {
  return typeof name === 'string' ? name : name.join(' ');
}

export async function enableService(options: ServiceOptions): Promise<void> {
  const { name, scope, user } = options;

  return task(
    `systemctl enable ${_label(name)}`,
    async (ctx) => {
      const names = _names(name);
      _checkNames(names);
      const infos = await Promise.all(names.map((n) => getServiceInfo({ name: n, scope })));
      /*
       * A service is considered enabled if its UnitFileState is "enabled" or
       * "enabled-runtime". Other states like "static", "alias", "indirect",
       * "generated", "transient" are not considered enabled here, even though
       * systemctl is-enabled returns 0 for them, because they don't represent
       * units that were explicitly enabled by the administrator.
       *
       * @see systemctl(1) is-enabled - enabled, enabled-runtime, linked,
       * masked, static, alias, indirect, generated, transient, bad, disabled, etc.
       */
      const targets = names.filter((_, i) => !ENABLED_STATES.includes(infos[i]!.UnitFileState));
      if (targets.length > 0) {
        if (!ctx.dryRun) await sh(_systemctl('enable', [...new Set(targets)], scope));
        for (const unit of new Set(targets)) {
          emitChanged({
            type: 'service',
            resource: unit,
            property: 'enabled',
            from: 'false',
            to: 'true',
          });
        }
      }
    },
    {
      details: () => ({ scope, user }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

export async function disableService(options: ServiceOptions): Promise<void> {
  const { name, scope, user } = options;

  return task(
    `systemctl disable ${_label(name)}`,
    async (ctx) => {
      const names = _names(name);
      _checkNames(names);
      const infos = await Promise.all(names.map((n) => getServiceInfo({ name: n, scope })));
      const targets = names.filter((_, i) => ENABLED_STATES.includes(infos[i]!.UnitFileState));
      if (targets.length > 0) {
        if (!ctx.dryRun) await sh(_systemctl('disable', [...new Set(targets)], scope));
        for (const unit of new Set(targets)) {
          emitChanged({
            type: 'service',
            resource: unit,
            property: 'enabled',
            from: 'true',
            to: 'false',
          });
        }
      }
    },
    {
      details: () => ({ scope, user }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

export async function startService(options: ServiceOptions & { name: string }): Promise<boolean>;
export async function startService(
  options: ServiceOptions & { name: readonly string[] },
): Promise<boolean[]>;
export async function startService(options: ServiceOptions): Promise<boolean | boolean[]> {
  const { name, scope, user } = options;
  const isArray = Array.isArray(name);

  return task(
    `systemctl start ${_label(name)}`,
    async (ctx) => {
      const names = _names(name);
      _checkNames(names);
      const infos = await Promise.all(names.map((n) => getServiceInfo({ name: n, scope })));
      const targets = new Set(
        names.filter(
          (_, i) =>
            (infos[i]!.LoadState === 'loaded' || infos[i]!.LoadState === 'merged') &&
            (infos[i]!.ActiveState === 'inactive' || infos[i]!.ActiveState === 'failed'),
        ),
      );
      const changed = names.map((n) => targets.has(n));
      if (targets.size > 0) {
        if (!ctx.dryRun) await sh(_systemctl('start', [...targets], scope));
        for (const unit of targets) {
          const info = infos[names.indexOf(unit)]!;
          emitChanged({
            type: 'service',
            resource: unit,
            property: 'state',
            from: info.ActiveState,
            to: 'active',
          });
        }
      }
      return isArray ? changed : changed[0]!;
    },
    {
      details: () => ({ scope, user }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

export async function stopService(options: ServiceOptions): Promise<void> {
  const { name, scope, user } = options;

  return task(
    `systemctl stop ${_label(name)}`,
    async (ctx) => {
      const names = _names(name);
      _checkNames(names);
      const infos = await Promise.all(names.map((n) => getServiceInfo({ name: n, scope })));
      const targets = names.filter(
        (_, i) =>
          (infos[i]!.LoadState === 'loaded' || infos[i]!.LoadState === 'merged') &&
          (infos[i]!.ActiveState === 'active' || infos[i]!.ActiveState === 'failed'),
      );
      if (targets.length > 0) {
        if (!ctx.dryRun) await sh(_systemctl('stop', [...new Set(targets)], scope));
        for (const unit of new Set(targets)) {
          const info = infos[names.indexOf(unit)]!;
          emitChanged({
            type: 'service',
            resource: unit,
            property: 'state',
            from: info.ActiveState,
            to: 'inactive',
          });
        }
      }
    },
    {
      details: () => ({ scope, user }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

export async function restartService(options: ServiceOptions): Promise<void> {
  const { name, scope, user } = options;

  return task(
    `systemctl restart ${_label(name)}`,
    async (ctx) => {
      const names = _names(name);
      _checkNames(names);
      const infos = await Promise.all(names.map((n) => getServiceInfo({ name: n, scope })));
      const targets = names.filter(
        (_, i) => infos[i]!.LoadState === 'loaded' || infos[i]!.LoadState === 'merged',
      );
      if (targets.length > 0) {
        if (!ctx.dryRun) await sh(_systemctl('restart', [...new Set(targets)], scope));
        for (const unit of new Set(targets)) {
          emitChanged({ type: 'service', resource: unit, property: 'state', to: 'restarted' });
        }
      }
    },
    {
      details: () => ({ scope, user }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

export async function reloadService(options: ServiceOptions): Promise<void> {
  const { name, scope, user } = options;

  return task(
    `systemctl reload ${_label(name)}`,
    async (ctx) => {
      const names = _names(name);
      _checkNames(names);
      const infos = await Promise.all(names.map((n) => getServiceInfo({ name: n, scope })));
      const targets = names.filter(
        (_, i) => infos[i]!.LoadState === 'loaded' || infos[i]!.LoadState === 'merged',
      );
      if (targets.length > 0) {
        if (!ctx.dryRun) await sh(_systemctl('reload', [...new Set(targets)], scope));
        for (const unit of new Set(targets)) {
          emitChanged({ type: 'service', resource: unit, property: 'state', to: 'reloaded' });
        }
      }
    },
    {
      details: () => ({ scope, user }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

/**
 * Build a systemctl command string.
 *
 * Since systemd v262 multiple units can be queued in one transaction
 * (e.g., `systemctl start a.service b.service`).
 *
 * @param action - systemctl action (e.g., "start", "stop", "enable")
 * @param unit - Unit name or list of unit names
 * @param options - Scope options
 * @returns Complete systemctl command string
 */
export function _systemctl(
  action: string,
  unit: string | readonly string[],
  scope: SystemdScope = 'system',
): string {
  const userFlag = scope === 'user' ? '--user ' : '';
  const units = typeof unit === 'string' ? $_(unit) : unit.map((u) => $_(u)).join(' ');
  return `systemctl ${userFlag}${action} ${units}`;
}

/**
 * States that indicate a unit is enabled.
 *
 * According to systemctl(1) is-enabled, these states return exit code 0:
 * - "enabled": Enabled via .wants/, .requires/ or Alias= symlinks
 * - "enabled-runtime": Same as enabled but in /run/systemd/system/
 * - "linked": Made available through a symlink to the unit file
 * - "alias": The name is an alias (symlink to another unit file)
 * - "static": Not enabled, has no [Install] section provisions
 * - "indirect": Enabled via WantedBy= in another unit's [Install] section
 * - "generated": Dynamically generated via generator tool
 * - "transient": Created dynamically with runtime API
 *
 * Note: "linked", "static", "alias", "indirect", "generated", and
 * "transient" return 0 but are not truly "enabled" in the traditional
 * sense. For the purpose of this operation, we only consider "enabled"
 * and "enabled-runtime" as enabled states.
 */
const ENABLED_STATES = ['enabled', 'enabled-runtime'];
