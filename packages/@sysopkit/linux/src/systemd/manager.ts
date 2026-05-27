import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { sh } from 'sysopkit/op/sh';

import type { SystemdScopeOptions } from './common.js';

/**
 * Reload systemd manager configuration.
 *
 * This must be called after creating, modifying, or deleting unit files
 * for systemd to recognize the changes.
 *
 * @param options - Scope options
 */
export async function daemonReload(options?: SystemdScopeOptions): Promise<void> {
  const scope = options?.scope ?? 'system';
  return task(
    `systemctl daemon-reload (${scope})`,
    async (ctx) => {
      if (!ctx.dryRun) {
        let cmd = 'systemctl';
        if (scope === 'user') {
          cmd += ' --user';
        }
        cmd += ' daemon-reload';
        await sh(cmd);
      }
      emitChanged({
        type: 'systemd',
        resource: 'daemon',
        property: 'reload',
      });
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
