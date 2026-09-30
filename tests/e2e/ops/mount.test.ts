import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { trackChanged } from '@sysopkit/test-utils';
import { getPathInfo, readFile, writeFile } from 'sysopkit/op/file';
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
      await sh(`mkdir -p ${src} ${target}`);
      await mount({ src, path: target, bind: true });
      // mkdir after the parent bind: the pre-mount `target/sub` would be
      // shadowed by the bind (mount point does not exist in the new view).
      await sh(`mkdir -p ${nested}`);
      await mount({ src, path: nested, bind: true });

      const t = trackChanged();
      await umount({ path: target, recursive: true, lazy: true });
      expect(t.changed).toBe(true);
      expect(await mountInfo({ path: target })).toBeNull();
      expect(await mountInfo({ path: nested })).toBeNull();
    });
  });

  test('umount recursive detaches orphaned child when parent is unmounted', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('mnt-orph-src-');
      const parent = remoteTempPath('mnt-orph-');
      const child = `${parent}/sub`;
      await sh(`mkdir -p ${src} ${child}`);
      await mount({ src, path: child, bind: true });
      expect(await mountInfo({ path: child })).not.toBeNull();

      // `umount -R <parent>` alone reports "not mounted" while the child
      // stays attached — the op must detach the orphan directly.
      const t = trackChanged();
      await umount({ path: parent, recursive: true });
      expect(t.changed).toBe(true);
      expect(await mountInfo({ path: child })).toBeNull();
    });
  });

  test('rbind propagates submounts with fused propagation and --mkdir', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('mnt-rbind-src-');
      const srcSub = `${src}/sub`;
      const target = `${remoteTempPath('mnt-rbind-')}/nested/dir`;
      await sh(`mkdir -p ${srcSub}`);
      await mount({ src: 'tmpfs', path: srcSub, fstype: 'tmpfs' });
      await writeFile(`${srcSub}/probe.txt`, 'deep\n');

      // NOTE: `rshared` stands in for the installer `rslave` here — slave
      // transitions are silently ignored in containers (no master peer
      // group; everything is private), while shared transitions apply.
      // The flag spelling is the only difference in the emit path.
      const t1 = trackChanged();
      await mount({ src, path: target, rbind: true, propagation: 'rshared', mkdir: true });
      expect(t1.changed).toBe(true);
      // Submount propagated through the rbind.
      expect(await readFile(`${target}/sub/probe.txt`)).toBe('deep\n');
      expect(await mountInfo({ path: `${target}/sub` })).not.toBeNull();
      expect((await mountInfo({ path: target }))?.propagation).toContain('shared');

      const t2 = trackChanged();
      await mount({ src, path: target, rbind: true, propagation: 'rshared', mkdir: true });
      expect(t2.changed).toBe(false);

      const t3 = trackChanged();
      await umount({ path: target, recursive: true });
      expect(t3.changed).toBe(true);
      expect(await mountInfo({ path: target })).toBeNull();

      await umount({ path: srcSub });
      expect(await mountInfo({ path: srcSub })).toBeNull();
    });
  });

  test('mkdir creates missing mountpoint parents for regular mounts', async () => {
    await sharedPodman(shared, async () => {
      const target = `${remoteTempPath('mnt-mkdir-')}/a/b`;

      const t1 = trackChanged();
      await mount({ src: 'tmpfs', path: target, fstype: 'tmpfs', mkdir: true });
      expect(t1.changed).toBe(true);
      const info = await mountInfo({ path: target });
      expect(info).not.toBeNull();
      expect(info?.fstype).toBe('tmpfs');

      const t2 = trackChanged();
      await mount({ src: 'tmpfs', path: target, fstype: 'tmpfs', mkdir: true });
      expect(t2.changed).toBe(false);

      await umount({ path: target });
      expect(await mountInfo({ path: target })).toBeNull();
    });
  });

  test('noCanonicalize file bind onto symlink is idempotent', async () => {
    await sharedPodman(shared, async () => {
      const dir = remoteTempPath('mnt-nc-');
      await sh(`mkdir -p ${dir}`);
      const srcFile = `${dir}/src.conf`;
      const realFile = `${dir}/real.conf`;
      const linkPath = `${dir}/link.conf`;
      await writeFile(srcFile, 'bound\n');
      await writeFile(realFile, 'real\n');
      await sh(`ln -s ${realFile} ${linkPath}`);

      const t1 = trackChanged();
      await mount({ src: srcFile, path: linkPath, bind: true, noCanonicalize: true });
      expect(t1.changed).toBe(true);
      expect(await readFile(linkPath)).toBe('bound\n');

      const t2 = trackChanged();
      await mount({ src: srcFile, path: linkPath, bind: true, noCanonicalize: true });
      expect(t2.changed).toBe(false);

      await umount({ path: linkPath });
      expect(await mountInfo({ path: linkPath })).toBeNull();
      // Underlying stub symlink revealed after umount.
      expect((await getPathInfo(linkPath))?.type).toBe('link');
      expect(await readFile(realFile)).toBe('real\n');
    });
  });

  test('propagation-only remount is idempotent', async () => {
    await sharedPodman(shared, async () => {
      const target = remoteTempPath('mnt-prop-');
      await sh(`mkdir -p ${target}`);
      await mount({ src: 'tmpfs', path: target, fstype: 'tmpfs' });
      // NOTE: shared transitions apply in containers; slave transitions
      // are silently ignored (no master peer group), so exercise the
      // propagation-only path with whichever shared/private flip applies.
      const before = (await mountInfo({ path: target }))?.propagation ?? '';
      const want: 'rprivate' | 'rshared' = before.includes('shared') ? 'rprivate' : 'rshared';
      const base = want.slice(1);

      const t1 = trackChanged();
      await mount({ path: target, propagation: want });
      expect(t1.changed).toBe(true);
      expect((await mountInfo({ path: target }))?.propagation).toContain(base);

      const t2 = trackChanged();
      await mount({ path: target, propagation: want });
      expect(t2.changed).toBe(false);

      await umount({ path: target });
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
