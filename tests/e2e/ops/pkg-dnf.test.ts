import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/linux/pkg/dnf';
import { trackChanged } from '@sysopkit/test-utils';
import { onChange, type ChangeEntry } from 'sysopkit';
import { sh } from 'sysopkit/op/sh';

import type { TestDistro } from '../images.js';
import { sharedPodman, startSharedContainer, type Container } from '../container.js';

/** Collects change entries emitted while `fn` runs. */
async function collectChanges(fn: () => Promise<void>): Promise<ChangeEntry[]> {
  const entries: ChangeEntry[] = [];
  await onChange((e) => {
    if (Array.isArray(e)) entries.push(...e);
    else entries.push(e);
  }, fn);
  return entries;
}

async function installedNames(): Promise<Set<string>> {
  return new Set((await getInstalledPackages()).map((p) => p.name));
}

for (const distro of ['fedora', 'redhat'] as const satisfies TestDistro[]) {
  describe(`pkg/dnf (${distro})`, () => {
    let shared: Container;
    beforeAll(async () => {
      shared = await startSharedContainer({ distro, publishSsh: false });
    });
    afterAll(async () => {
      if (shared) await shared.stop();
    });

    test(
      'installs and removes a tiny package',
      async () => {
        await sharedPodman(shared, async () => {
          await removePackages({ packages: ['ed'] }).catch(() => {});

          const t1 = trackChanged();
          await installPackages({ packages: ['ed'] });
          expect(t1.changed).toBe(true);
          expect((await getInstalledPackages()).some((p) => p.name === 'ed')).toBe(true);
          expect((await sh('command -v ed')).exitCode).toBe(0);

          const t2 = trackChanged();
          await installPackages({ packages: ['ed'] });
          expect(t2.changed).toBe(false);

          await removePackages({ packages: ['ed'] });
          expect((await getInstalledPackages()).some((p) => p.name === 'ed')).toBe(false);
        });
      },
      { timeout: 300000 },
    );

    test(
      'remove cleans unused dependencies natively',
      async () => {
        await sharedPodman(shared, async () => {
          await removePackages({ packages: ['jq'] }).catch(() => {});
          const before = await installedNames();

          const installed = await collectChanges(() => installPackages({ packages: ['jq'] }));
          const added = [...(await installedNames())].filter((n) => !before.has(n));
          expect(added).toContain('jq');
          const deps = added.filter((n) => n !== 'jq');
          expect(deps.length).toBeGreaterThan(0);
          for (const n of added) {
            expect(installed.some((c) => c.resource === n && c.to === 'installed')).toBe(true);
          }

          const entries = await collectChanges(() => removePackages({ packages: ['jq'] }));
          const removed = entries.filter((c) => c.to === 'removed').map((c) => c.resource);
          for (const n of added) expect(removed).toContain(n);
          const gone = await installedNames();
          for (const n of added) expect(gone.has(n)).toBe(false);
        });
      },
      { timeout: 300000 },
    );

    test('lists installed base packages', async () => {
      await sharedPodman(shared, async () => {
        const pkgs = await getInstalledPackages();
        expect(pkgs.length).toBeGreaterThan(10);
        expect(pkgs.some((p) => p.name === 'bash')).toBe(true);
      });
    });
  });
}
