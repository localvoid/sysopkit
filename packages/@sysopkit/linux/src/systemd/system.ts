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

      if (!ctx.dryRun) await sh(`hostnamectl hostname ${$_(name)}`);
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

export type SetLocaleOptions =
  | {
      /** Variable name (e.g., "LANG"). */
      readonly name: string;
      /** Variable value (e.g., "C.UTF-8"). */
      readonly value: string;
      readonly locale?: never;
    }
  | {
      /** Bare locale (sets LANG), e.g., "C.UTF-8". */
      readonly locale: string;
      readonly name?: never;
      readonly value?: never;
    };

export async function setLocale(options: SetLocaleOptions): Promise<void> {
  let prop: string;
  let value: string;
  let arg: string;
  if (options.locale !== undefined) {
    prop = 'LANG';
    value = options.locale;
    arg = options.locale;
  } else {
    prop = options.name;
    value = options.value;
    arg = `${options.name}=${options.value}`;
  }

  return task(
    `set locale ${arg}`,
    async (ctx) => {
      const localeConf = parseShellConf(await readFile(LOCALE_CONF));
      const currentValue = localeConf[prop];
      if (currentValue === value) {
        return;
      }

      if (!ctx.dryRun) await sh(`localectl set-locale ${$_(arg)}`);
      emitChanged({
        type: 'systemd',
        resource: 'locale',
        property: prop,
        from: currentValue,
        to: value,
      });
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
