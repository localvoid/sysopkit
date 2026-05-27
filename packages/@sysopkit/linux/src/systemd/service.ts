/**
 * @module systemd/service
 *
 * Service management operations for systemd.
 *
 * @see systemctl(1) - Control the systemd system and service manager
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

import { parseKeyValue, type SystemdScopeOptions } from './common.js';

export interface ServiceInfo {
  readonly LoadState: string;
  readonly ActiveState: string;
  readonly SubState: string;
  readonly UnitFileState: string;
  readonly MainPid: number;
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
  readonly name: string;
}

export async function enableService(options: ServiceOptions): Promise<void> {
  const { name, scope, user } = options;

  return task(
    `systemctl enable ${name}`,
    async (ctx) => {
      const info = await getServiceInfo(options);
      /*
       * A service is considered enabled if its UnitFileState is "enabled" or
       * "enabled-runtime". Other states like "static", "alias", "generated",
       * "transient" are not considered enabled here, even though systemctl
       * is-enabled returns 0 for them, because they don't represent units
       * that were explicitly enabled by the administrator.
       *
       * @see systemctl(1) is-enabled - for the full list of states and their meanings
       */
      const isEnabled = ENABLED_STATES.includes(info.UnitFileState);
      if (!isEnabled) {
        if (!ctx.dryRun) await sh(_systemctl('enable', name, scope));
        emitChanged({
          type: 'service',
          resource: name,
          property: 'enabled',
          from: 'false',
          to: 'true',
        });
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
    `systemctl disable ${name}`,
    async (ctx) => {
      const info = await getServiceInfo(options);
      const isEnabled = ENABLED_STATES.includes(info.UnitFileState);
      if (isEnabled) {
        if (!ctx.dryRun) await sh(_systemctl('disable', name, scope));
        emitChanged({
          type: 'service',
          resource: name,
          property: 'enabled',
          from: 'true',
          to: 'false',
        });
      }
    },
    {
      details: () => ({ scope, user }),
      verbosity: VERBOSITY_TRACE,
    },
  );
}

export async function startService(options: ServiceOptions): Promise<boolean> {
  const { name, scope, user } = options;

  return task(
    `systemctl start ${name}`,
    async (ctx) => {
      const info = await getServiceInfo(options);
      if (info.LoadState === 'loaded' || info.LoadState === 'merged') {
        if (info.ActiveState === 'inactive') {
          if (!ctx.dryRun) await sh(_systemctl('start', name, scope));
          emitChanged({
            type: 'service',
            resource: name,
            property: 'state',
            from: info.ActiveState,
            to: 'active',
          });
          return true;
        }
      }
      return false;
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
    `systemctl stop ${name}`,
    async (ctx) => {
      const info = await getServiceInfo(options);
      if (info.LoadState === 'loaded' || info.LoadState === 'merged') {
        if (info.ActiveState === 'active') {
          if (!ctx.dryRun) await sh(_systemctl('stop', name, scope));
          emitChanged({
            type: 'service',
            resource: name,
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
    `servicectl restart ${name}`,
    async (ctx) => {
      const info = await getServiceInfo(options);
      if (info.ActiveState === 'active') {
        if (!ctx.dryRun) await sh(_systemctl('restart', name, scope));
        emitChanged({ type: 'service', resource: name, property: 'state', to: 'restarted' });
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
    `servicectl reload ${name}`,
    async (ctx) => {
      const info = await getServiceInfo(options);
      if (info.ActiveState === 'active') {
        if (!ctx.dryRun) await sh(_systemctl('reload', name, scope));
        emitChanged({ type: 'service', resource: name, property: 'state', to: 'reloaded' });
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
 * @param action - systemctl action (e.g., "start", "stop", "enable")
 * @param unit - Unit name
 * @param options - Scope options
 * @returns Complete systemctl command string
 */
export function _systemctl(action: string, unit: string, scope: string = 'system'): string {
  const userFlag = scope === 'user' ? '--user ' : '';
  return `systemctl ${userFlag}${action} ${$_(unit)}`;
}

/**
 * States that indicate a unit is enabled.
 *
 * According to systemctl(1) is-enabled, these states return exit code 0:
 * - "enabled": Enabled via .wants/, .requires/ or Alias= symlinks
 * - "enabled-runtime": Same as enabled but in /run/systemd/system/
 * - "alias": The name is an alias (symlink to another unit file)
 * - "static": Not enabled, has no [Install] section provisions
 * - "generated": Dynamically generated via generator tool
 * - "transient": Created dynamically with runtime API
 *
 * Note: "static", "generated", and "transient" return 0 but are not truly
 * "enabled" in the traditional sense. For the purpose of this operation,
 * we only consider "enabled" and "enabled-runtime" as enabled states.
 */
const ENABLED_STATES = ['enabled', 'enabled-runtime'];
