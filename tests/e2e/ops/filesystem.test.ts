import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { trackChanged } from '@sysopkit/test-utils';
import { onChange, waitUntil, type ChangeEntry } from 'sysopkit';
import { exec } from 'sysopkit/op/exec';
import {
  cp,
  createDir,
  createFile,
  createLink,
  deleteDir,
  deleteFile,
  deleteLink,
  getFileStat,
  getPathInfo,
  readFile,
  readFileBuffer,
  sha256,
  touchFile,
  tryReadFile,
  tryReadFileBuffer,
  writeFile,
} from 'sysopkit/op/file';
import { $_, sh } from 'sysopkit/op/sh';
import { tar, untar } from 'sysopkit/op/tar';
import { withTempDir, withTempFile } from 'sysopkit/op/temp';

import {
  remoteTempPath,
  sharedPodman,
  startSharedContainer,
  type Container,
} from '../container.js';

describe('filesystem ops', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'redhat', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('createFile writes content and is idempotent', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-file-');
      const t1 = trackChanged();
      await createFile({ path: p, content: 'hello\n' });
      expect(t1.changed).toBe(true);
      expect(await readFile(p)).toBe('hello\n');

      const t2 = trackChanged();
      await createFile({ path: p, content: 'hello\n' });
      expect(t2.changed).toBe(false);

      const t3 = trackChanged();
      await createFile({ path: p, content: 'changed\n' });
      expect(t3.changed).toBe(true);
      expect(await readFile(p)).toBe('changed\n');
    });
  });

  test('createFile applies mode and ownership', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-mode-');
      await createFile({
        path: p,
        content: 'x\n',
        mode: 0o600,
        user: 'testuser',
        group: 'testuser',
      });
      const s1 = await getFileStat(p);
      expect(s1.mode).toBe(0o600);
      expect(s1.user).toBe('testuser');
      expect(s1.group).toBe('testuser');

      const tSame = trackChanged();
      await createFile({
        path: p,
        content: 'x\n',
        mode: 0o600,
        user: 'testuser',
        group: 'testuser',
      });
      expect(tSame.changed).toBe(false);

      const t = trackChanged();
      await createFile({ path: p, content: 'x\n', mode: 0o644, user: 'root', group: 'root' });
      expect(t.changed).toBe(true);
      const s2 = await getFileStat(p);
      expect(s2.mode).toBe(0o644);
      expect(s2.user).toBe('root');
      expect(s2.group).toBe('root');

      // Group-only update reports property 'group' (not 'user').
      const seen: (ChangeEntry | ChangeEntry[])[] = [];
      await onChange(
        (e) => {
          seen.push(e);
        },
        async () => {
          await createFile({
            path: p,
            content: 'x\n',
            mode: 0o644,
            user: 'root',
            group: 'testuser',
          });
        },
      );
      expect(seen.flat().some((c) => c.property === 'group' && c.to === 'testuser')).toBe(true);
      expect((await getFileStat(p)).group).toBe('testuser');
    });
  });

  test('writeFile / tryReadFile round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-rw-');
      expect(await tryReadFile(p)).toBeUndefined();
      await writeFile(p, 'data-123\n');
      expect(await tryReadFile(p)).toBe('data-123\n');
      expect((await getPathInfo(p))?.type).toBe('file');
    });
  });

  test('writeFile / readFileBuffer round-trip preserves binary content', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-rwbuf-');
      expect(await tryReadFileBuffer(p)).toBeUndefined();
      const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255, 10]);
      await writeFile(p, bytes);
      expect(await readFileBuffer(p)).toEqual(bytes);
      expect(await tryReadFileBuffer(p)).toEqual(bytes);
    });
  });

  test('touchFile creates file', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-touch-');
      const t = trackChanged();
      await touchFile({ path: p });
      expect(t.changed).toBe(true);
      expect(await getPathInfo(p)).toBeDefined();
    });
  });

  test('createDir / deleteDir round-trip', async () => {
    await sharedPodman(shared, async () => {
      const base = remoteTempPath('fs-dir-');
      const nested = `${base}/a/b`;
      const t = trackChanged();
      await createDir({
        path: nested,
        recursive: true,
        mode: 0o750,
        user: 'testuser',
        group: 'testuser',
      });
      expect(t.changed).toBe(true);
      expect((await getPathInfo(nested))?.type).toBe('dir');
      const s1 = await getFileStat(nested);
      expect(s1.mode).toBe(0o750);
      expect(s1.user).toBe('testuser');
      expect(s1.group).toBe('testuser');

      const tSame = trackChanged();
      await createDir({
        path: nested,
        recursive: true,
        mode: 0o750,
        user: 'testuser',
        group: 'testuser',
      });
      expect(tSame.changed).toBe(false);

      const tUpdate = trackChanged();
      await createDir({ path: nested, mode: 0o755, user: 'root', group: 'root' });
      expect(tUpdate.changed).toBe(true);
      const s2 = await getFileStat(nested);
      expect(s2.mode).toBe(0o755);
      expect(s2.user).toBe('root');
      expect(s2.group).toBe('root');

      await deleteDir({ path: base, recursive: true });
      expect(await getPathInfo(base)).toBeUndefined();

      const single = remoteTempPath('fs-dir-single-');
      await createDir({ path: single });
      expect((await getPathInfo(single))?.type).toBe('dir');
      const tDel = trackChanged();
      await deleteDir({ path: single });
      expect(tDel.changed).toBe(true);
      expect(await getPathInfo(single)).toBeUndefined();
    });
  });

  test('createLink / deleteLink round-trip', async () => {
    await sharedPodman(shared, async () => {
      const target = remoteTempPath('fs-target-');
      const link = remoteTempPath('fs-link-');
      await writeFile(target, 'target\n');
      const t = trackChanged();
      await createLink({ path: link, target, user: 'testuser', group: 'testuser' });
      expect(t.changed).toBe(true);
      expect((await getPathInfo(link))?.type).toBe('link');
      const s1 = await getFileStat(link);
      expect(s1.user).toBe('testuser');
      expect(s1.group).toBe('testuser');
      // Ownership applies to the link itself, never the target.
      const st1 = await getFileStat(target);
      expect(st1.user).toBe('root');
      expect(st1.group).toBe('root');

      const tSame = trackChanged();
      await createLink({ path: link, target, user: 'testuser', group: 'testuser' });
      expect(tSame.changed).toBe(false);

      const tUpdate = trackChanged();
      await createLink({ path: link, target, user: 'root', group: 'root' });
      expect(tUpdate.changed).toBe(true);
      const s2 = await getFileStat(link);
      expect(s2.user).toBe('root');
      expect(s2.group).toBe('root');
      expect(await readFile(link)).toBe('target\n');

      await deleteLink({ path: link });
      expect(await getPathInfo(link)).toBeUndefined();
      expect(await readFile(target)).toBe('target\n');
    });
  });

  test('deleteFile removes file and is idempotent', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-del-');
      await writeFile(p, 'bye\n');
      const t1 = trackChanged();
      await deleteFile({ path: p });
      expect(t1.changed).toBe(true);
      expect(await getPathInfo(p)).toBeUndefined();

      const t2 = trackChanged();
      await deleteFile({ path: p });
      expect(t2.changed).toBe(false);
    });
  });

  test('sha256 matches system sha256sum', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-hash-');
      await writeFile(p, 'hash me\n');
      const hash = await sha256(p);
      const { stdout } = await sh(`sha256sum ${$_(p)}`);
      expect(hash).toBe(stdout.trim().split(/\s+/)[0]);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  test('sha256 throws for missing file', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-hash-missing-');
      try {
        await sha256(p);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  test('getFileStat reports metadata', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-stat-');
      await createFile({ path: p, content: '12345', mode: 0o644 });
      const s = await getFileStat(p);
      expect(s.size).toBe(5);
      expect(s.mode).toBe(0o644);
      expect(s.user).toBe('root');
      expect(s.group).toBe('root');
      expect(s.type).toContain('regular');
    });
  });

  test('tar packs and untar restores', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('fs-tar-src-');
      const archive = `${remoteTempPath('fs-tar-')}.tar.gz`;
      const dst = remoteTempPath('fs-tar-dst-');
      await sh(
        `mkdir -p ${$_(src)}/sub && echo one > ${$_(src)}/a.txt && echo two > ${$_(src)}/sub/b.txt`,
      );

      await tar({ src, dst: archive });
      expect((await getPathInfo(archive))?.type).toBe('file');

      await sh(`mkdir -p ${$_(dst)}`);
      await untar({ src: archive, dst });
      expect(await readFile(`${dst}/a.txt`)).toBe('one\n');
      expect(await readFile(`${dst}/sub/b.txt`)).toBe('two\n');
    });
  });

  test('waitUntil resolves when file appears', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-wait-');
      await sh(`(sleep 0.3; echo ready > ${$_(p)}) &`);
      await waitUntil(async () => (await getPathInfo(p)) !== void 0, {
        intervalMs: 50,
        timeoutMs: 10_000,
        describe: `file ${p} to appear`,
      });
      expect(await readFile(p)).toBe('ready\n');
    });
  });

  test('waitUntil resolves when pattern appears', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-wait-content-');
      await writeFile(p, 'booting\n');
      await sh(`(sleep 0.3; echo 'Server started' >> ${$_(p)}) &`);
      await waitUntil(async () => ((await tryReadFile(p)) ?? '').includes('Server started'), {
        intervalMs: 50,
        timeoutMs: 10_000,
        describe: `pattern in ${p}`,
      });
      expect((await readFile(p)).includes('Server started')).toBe(true);
    });
  });

  test('cp copies a file', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('fs-cp-src-');
      const dst = remoteTempPath('fs-cp-dst-');
      await writeFile(src, 'copy me\n');
      const t = trackChanged();
      await cp({ src, dst });
      expect(t.changed).toBe(true);
      expect(await readFile(dst)).toBe('copy me\n');
      expect(await readFile(src)).toBe('copy me\n');
    });
  });

  test('cp copies directories recursively with reflink', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('fs-cpdir-src-');
      const dst = remoteTempPath('fs-cpdir-dst-');
      await sh(
        `mkdir -p ${$_(src)}/sub && echo one > ${$_(src)}/a.txt && echo two > ${$_(src)}/sub/b.txt`,
      );
      await cp({ src, dst, recursive: true, reflink: 'auto', sparse: 'auto' });
      expect(await readFile(`${dst}/a.txt`)).toBe('one\n');
      expect(await readFile(`${dst}/sub/b.txt`)).toBe('two\n');
    });
  });

  test('cp copies multiple sources into a directory', async () => {
    await sharedPodman(shared, async () => {
      const a = remoteTempPath('fs-cpmulti-a-');
      const b = remoteTempPath('fs-cpmulti-b-');
      const dir = remoteTempPath('fs-cpmulti-dst-');
      await writeFile(a, 'a\n');
      await writeFile(b, 'b\n');
      await sh(`mkdir -p ${$_(dir)}`);
      await cp({ src: [a, b], dst: dir, force: true });
      expect(await readFile(`${dir}/${a.split('/').pop()}`)).toBe('a\n');
      expect(await readFile(`${dir}/${b.split('/').pop()}`)).toBe('b\n');
    });
  });

  test('cp refuses invalid reflink mode', async () => {
    await sharedPodman(shared, async () => {
      try {
        await cp({
          src: remoteTempPath('fs-cp-bad-'),
          dst: remoteTempPath('fs-cp-bad-dst-'),
          reflink: 'sometimes' as never,
        });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('invalid reflink mode');
      }
    });
  });

  test('exec read-back verifies file ops', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-exec-');
      await createFile({ path: p, content: 'via-op\n' });
      const { stdout, exitCode } = await exec(['cat', p]);
      expect(exitCode).toBe(0);
      expect(stdout).toBe('via-op\n');
    });
  });

  test('withTempFile writes content and cleans up', async () => {
    await sharedPodman(shared, async () => {
      let tmp = '';
      await withTempFile(
        async (path) => {
          tmp = path;
          expect(path.startsWith('/tmp/')).toBe(true);
          expect((await getPathInfo(path))?.type).toBe('file');
          expect(await readFile(path)).toBe('temp-data\n');
        },
        { content: 'temp-data\n' },
      );
      expect(await getPathInfo(tmp)).toBeUndefined();
    });
  });

  test('withTempFile cleans up when callback throws', async () => {
    await sharedPodman(shared, async () => {
      let tmp = '';
      try {
        await withTempFile(async (path) => {
          tmp = path;
          expect((await getPathInfo(path))?.type).toBe('file');
          throw new Error('boom');
        });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('boom');
      }
      expect(await getPathInfo(tmp)).toBeUndefined();
    });
  });

  test('withTempDir stages files and cleans up', async () => {
    await sharedPodman(shared, async () => {
      let tmp = '';
      await withTempDir(async (dir) => {
        tmp = dir;
        expect((await getPathInfo(dir))?.type).toBe('dir');
        await writeFile(`${dir}/a.txt`, 'a\n');
        expect(await readFile(`${dir}/a.txt`)).toBe('a\n');
      });
      expect(await getPathInfo(tmp)).toBeUndefined();
    });
  });
});
