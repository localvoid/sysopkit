import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { trackChanged } from '@sysopkit/test-utils';
import {
  getInstalledPackages,
  installPackages,
  removePackages,
} from '@sysopkit/linux/pkg/dnf';
import { sh } from 'sysopkit/op/sh';

import { sharedPodman, startSharedContainer, type Container } from '../container.js';
import type { TestDistro } from '../images.js';

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

    test('lists installed base packages', async () => {
      await sharedPodman(shared, async () => {
        const pkgs = await getInstalledPackages();
        expect(pkgs.length).toBeGreaterThan(10);
        expect(pkgs.some((p) => p.name === 'bash')).toBe(true);
      });
    });
  });
}
