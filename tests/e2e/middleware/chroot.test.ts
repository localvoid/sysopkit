import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { chroot } from 'sysopkit/middleware/chroot';
import { exec } from 'sysopkit/op/exec';
import { createFile, getPathInfo, readFile, tryReadFile } from 'sysopkit/op/file';
import { mount } from 'sysopkit/op/mount';
import { $_, sh } from 'sysopkit/op/sh';

import {
  remoteTempPath,
  sharedPodman,
  startSharedContainer,
  type Container,
} from '../container.js';

/**
 * Chroot middleware against a fake root: `/usr` bind-mounted in with
 * merged-usr symlinks (`/bin -> usr/bin`, …), so `chroot <root> /bin/sh`
 * resolves. Privileged for the bind mount; mounts stay inside the
 * container's mount namespace and the container is discarded in afterAll.
 * Assertions read back final remote state, never generated shell strings.
 */
describe('chroot middleware (privileged)', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'redhat', publishSsh: false, privileged: true });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  /** Fake root with a working `/bin/sh`, built once per file (tests run serially). */
  let root = '';
  async function ensureRoot(): Promise<string> {
    if (root !== '') {
      return root;
    }
    root = remoteTempPath('chroot-root-');
    await sh(`mkdir -p ${$_(root + '/tmp')} ${$_(root + '/usr')}`);
    await sh(
      `ln -sfn usr/bin ${$_(root + '/bin')} && ln -sfn usr/lib ${$_(root + '/lib')} && ln -sfn usr/lib64 ${$_(root + '/lib64')}`,
    );
    await mount({ src: '/usr', path: `${root}/usr`, bind: true });
    // Smoke: the shell resolves inside the new root.
    await chroot(root, async () => {
      const { stdout, exitCode } = await exec(['sh', '-c', 'echo ready']);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('ready');
    });
    return root;
  }

  test('createFile inside chroot lands under the root, host path untouched', async () => {
    await sharedPodman(shared, async () => {
      const r = await ensureRoot();
      const name = `chroot-file-${Date.now()}.txt`;
      await chroot(r, async () => {
        await createFile({ path: `/tmp/${name}`, content: 'inside\n' });
        // Read-back through the same confinement sees the file.
        expect(await readFile(`/tmp/${name}`)).toBe('inside\n');
      });
      // Host-side read-back: content is under the root, not on the host path.
      expect(await readFile(`${r}/tmp/${name}`)).toBe('inside\n');
      expect(await tryReadFile(`/tmp/${name}`)).toBeUndefined();
    });
  });

  test('sh inside chroot writes under the root', async () => {
    await sharedPodman(shared, async () => {
      const r = await ensureRoot();
      const name = `chroot-sh-${Date.now()}.txt`;
      await chroot(r, async () => {
        await sh(`echo from-sh > ${$_(`/tmp/${name}`)}`);
      });
      expect(await readFile(`${r}/tmp/${name}`)).toBe('from-sh\n');
      expect(await getPathInfo(`/tmp/${name}`)).toBeUndefined();
    });
  });

  test('exec array form runs inside chroot', async () => {
    await sharedPodman(shared, async () => {
      const r = await ensureRoot();
      const name = `chroot-exec-${Date.now()}.txt`;
      await chroot(r, async () => {
        const { exitCode } = await exec(['touch', `/tmp/${name}`]);
        expect(exitCode).toBe(0);
        expect((await getPathInfo(`/tmp/${name}`))?.type).toBe('file');
      });
      expect((await getPathInfo(`${r}/tmp/${name}`))?.type).toBe('file');
    });
  });

  test('invalid roots throw before spawning', async () => {
    await sharedPodman(shared, async () => {
      for (const bad of ['', 'relative/path', '/']) {
        try {
          await chroot(bad, async () => {
            expect.unreachable();
          });
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toContain('refusing');
        }
      }
    });
  });
});
