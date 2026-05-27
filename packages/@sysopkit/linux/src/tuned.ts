/**
 * @module op/tuned
 *
 * Tuned profile management for Linux systems.
 *
 * Tuned is a daemon that monitors system components and tunes system
 * settings dynamically. It provides predefined profiles for various
 * workloads (throughput, latency, powersave, etc.).
 *
 * @see tuned-adm(8) - command line tool for tuned
 */

import { emitChanged, task, VERBOSITY_NORMAL } from 'sysopkit';
import { tryReadFile } from 'sysopkit/op/file';
import { $_, sh } from 'sysopkit/op/sh';

export interface SetTuneProfileOptions {
  readonly profile: string | null;
}

export async function setTuneProfile({ profile }: SetTuneProfileOptions): Promise<void> {
  return task(
    profile === null ? `disable tuned profile` : `set tuned profile ${profile}`,
    async (ctx) => {
      const current = await _getActiveProfile();
      if (profile === null) {
        if (current === void 0) {
          return;
        }
        if (!ctx.dryRun) await sh('tuned-adm off');
        emitChanged({
          type: 'service',
          resource: 'tuned',
          property: 'profile',
          from: current,
          to: 'disabled',
        });
        return;
      }

      if (current === profile) {
        return;
      }

      if (!ctx.dryRun) await sh(`tuned-adm profile ${$_(profile)}`);
      emitChanged({
        type: 'service',
        resource: 'tuned',
        property: 'profile',
        from: current,
        to: profile,
      });
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

export async function _getActiveProfile(): Promise<string | undefined> {
  return await tryReadFile('/etc/tuned/active_profile');
}
