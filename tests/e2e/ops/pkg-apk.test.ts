import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/openwrt/pkg/apk';
import { trackChanged } from '@sysopkit/test-utils';
import { onChange, type ChangeEntry } from 'sysopkit';
import { sh } from 'sysopkit/op/sh';

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

/** OpenWrt is non-parity: only `sh` + busybox applets, no sudo user. */
describe('pkg/apk (openwrt)', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'openwrt', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test(
    'installs and removes a tiny package',
    async () => {
      await sharedPodman(shared, async () => {
        await removePackages({ packages: ['nano'] }).catch(() => {});

        const t1 = trackChanged();
        await installPackages({ packages: ['nano'] });
        expect(t1.changed).toBe(true);
        expect((await getInstalledPackages()).some((p) => p.name === 'nano')).toBe(true);
        expect((await sh('command -v nano')).exitCode).toBe(0);

        const t2 = trackChanged();
        await installPackages({ packages: ['nano'] });
        expect(t2.changed).toBe(false);

        const t3 = trackChanged();
        await removePackages({ packages: ['nano'] });
        expect(t3.changed).toBe(true);
        expect((await getInstalledPackages()).some((p) => p.name === 'nano')).toBe(false);
      });
    },
    { timeout: 300000 },
  );

  test(
    'install reports change in dry-run without installing',
    async () => {
      await sharedPodman(shared, async () => {
        await removePackages({ packages: ['nano'] }).catch(() => {});
      });
      await sharedPodman(
        shared,
        async () => {
          const t = trackChanged();
          await installPackages({ packages: ['nano'] });
          expect(t.changed).toBe(true);
          expect((await getInstalledPackages()).some((p) => p.name === 'nano')).toBe(false);
        },
        { dryRun: true },
      );
    },
    { timeout: 300000 },
  );

  test(
    'remove purges unused dependencies natively',
    async () => {
      await sharedPodman(shared, async () => {
        await removePackages({ packages: ['nano'] }).catch(() => {});
        const before = await installedNames();

        await installPackages({ packages: ['nano'] });
        const added = [...(await installedNames())].filter((n) => !before.has(n));
        expect(added).toContain('nano');
        expect(added.length).toBeGreaterThan(1);

        const entries = await collectChanges(() => removePackages({ packages: ['nano'] }));
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
      expect(pkgs.some((p) => p.name === 'busybox')).toBe(true);
    });
  });
});
