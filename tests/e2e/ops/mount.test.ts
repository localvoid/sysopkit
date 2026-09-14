import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { trackChanged } from '@sysopkit/test-utils';
import { readFile, writeFile } from 'sysopkit/op/file';
import { mount, mountInfo, umount } from 'sysopkit/op/mount';
import { sh } from 'sysopkit/op/sh';

import {
  remoteTempPath,
  sharedPodman,
  startSharedContainer,
  type Container,
} from '../container.js';

/**
 * Real mount/umount in an isolated privileged container. Mounts stay inside
 * the container's mount namespace on unique remoteTempPath() targets —
 * never host paths. Container is discarded in afterAll.
 */
describe('mount ops (privileged)', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'redhat', publishSsh: false, privileged: true });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('mountInfo returns null for unmounted path', async () => {
    await sharedPodman(shared, async () => {
      expect(await mountInfo({ path: remoteTempPath('mnt-') })).toBeNull();
    });
  });

  test('mount tmpfs → mountInfo round-trip → umount', async () => {
    await sharedPodman(shared, async () => {
      const target = remoteTempPath('mnt-tmpfs-');
      await sh(`mkdir -p ${target}`);

      const t1 = trackChanged();
      await mount({ src: 'tmpfs', path: target, fstype: 'tmpfs' });
      expect(t1.changed).toBe(true);

      const info = await mountInfo({ path: target });
      expect(info).not.toBeNull();
      expect(info?.fstype).toBe('tmpfs');

      // Data written inside the mount is visible via file ops.
      await writeFile(`${target}/probe.txt`, 'mounted\n');
      expect(await readFile(`${target}/probe.txt`)).toBe('mounted\n');

      const t2 = trackChanged();
      await mount({ src: 'tmpfs', path: target, fstype: 'tmpfs' });
      expect(t2.changed).toBe(false);

      const t3 = trackChanged();
      await umount({ path: target });
      expect(t3.changed).toBe(true);
      expect(await mountInfo({ path: target })).toBeNull();
    });
  });

  test('umount is idempotent for unmounted path', async () => {
    await sharedPodman(shared, async () => {
      const t = trackChanged();
      await umount({ path: remoteTempPath('mnt-idem-') });
      expect(t.changed).toBe(false);
    });
  });

  test('mount reports change in dry-run without mounting', async () => {
    await sharedPodman(
      shared,
      async () => {
        const target = remoteTempPath('mnt-dry-');
        await sh(`mkdir -p ${target}`);
        const t = trackChanged();
        await mount({ src: 'tmpfs', path: target, fstype: 'tmpfs' });
        expect(t.changed).toBe(true);
        expect(await mountInfo({ path: target })).toBeNull();
      },
      { dryRun: true },
    );
  });
});
