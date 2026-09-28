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

  test('mount --bind round-trip with idempotent re-bind', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('mnt-bind-src-');
      const target = remoteTempPath('mnt-bind-');
      await sh(`mkdir -p ${src} ${target}`);
      await writeFile(`${src}/probe.txt`, 'bound\n');

      const t1 = trackChanged();
      await mount({ src, path: target, bind: true });
      expect(t1.changed).toBe(true);
      expect(await readFile(`${target}/probe.txt`)).toBe('bound\n');

      const t2 = trackChanged();
      await mount({ src, path: target, bind: true });
      expect(t2.changed).toBe(false);

      const t3 = trackChanged();
      await umount({ path: target });
      expect(t3.changed).toBe(true);
      expect(await mountInfo({ path: target })).toBeNull();
    });
  });

  test('umount recursive+lazy detaches nested binds', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('mnt-rec-src-');
      const target = remoteTempPath('mnt-rec-');
      const nested = `${target}/sub`;
      await sh(`mkdir -p ${src} ${nested}`);
      await mount({ src, path: target, bind: true });
      await mount({ src, path: nested, bind: true });

      const t = trackChanged();
      await umount({ path: target, recursive: true, lazy: true });
      expect(t.changed).toBe(true);
      expect(await mountInfo({ path: target })).toBeNull();
      expect(await mountInfo({ path: nested })).toBeNull();
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
