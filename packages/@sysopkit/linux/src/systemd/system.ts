/**
 * @module systemd/system
 *
 * System hostname, timezone, and locale management operations.
 *
 * @see hostnamectl(1) - Control the system hostname
 * @see timedatectl(1) - Control the system time and date
 * @see localectl(1) - Control the system locale and keyboard settings
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { readFile } from 'sysopkit/op/file';
import { $_, parseShellConf, sh } from 'sysopkit/op/sh';

export interface SetHostnameOptions {
  readonly name: string;
}

export async function setHostname(options: SetHostnameOptions): Promise<void> {
  const { name } = options;

  return task(
    `set hostname '${name}'`,
    async (ctx) => {
      const { stdout } = await sh('hostnamectl hostname');
      const current = stdout.trim();
      if (current === name) {
        return;
      }

      if (!ctx.dryRun) await sh(`hostnamectl set-hostname ${$_(name)}`);
      emitChanged({
        type: 'systemd',
        resource: 'hostname',
        property: 'name',
        from: current,
        to: name,
      });
    },
    { verbosity: VERBOSITY_TRACE },
  );
}

export interface SetTimezoneOptions {
  readonly name: string;
}

export async function setTimezone(options: SetTimezoneOptions): Promise<void> {
  const { name } = options;

  return task(
    `set timezone '${name}'`,
    async (ctx) => {
      const { stdout } = await sh('timedatectl show -p Timezone --value');
      const current = stdout.trim();
      if (current === name) {
        return;
      }

      if (!ctx.dryRun) await sh(`timedatectl set-timezone ${$_(name)}`);
      emitChanged({
        type: 'systemd',
        resource: 'timezone',
        property: 'name',
        from: current,
        to: name,
      });
    },
    { verbosity: VERBOSITY_TRACE },
  );
}

const LOCALE_CONF = '/etc/locale.conf';

export interface SetLocaleOptions {
  readonly name: string;
  readonly value: string;
}

export async function setLocale(options: SetLocaleOptions): Promise<void> {
  const { name, value } = options;

  return task(
    `set locale ${name}=${value}`,
    async (ctx) => {
      const localeConf = parseShellConf(await readFile(LOCALE_CONF));
      const currentValue = localeConf[name];
      if (currentValue === value) {
        return;
      }

      if (!ctx.dryRun) await sh(`localectl set-locale ${$_(`${name}=${value}`)}`);
      emitChanged({
        type: 'systemd',
        resource: 'locale',
        property: name,
        from: currentValue,
        to: value,
      });
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
