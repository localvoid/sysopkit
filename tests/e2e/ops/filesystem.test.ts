import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { trackChanged } from '@sysopkit/test-utils';
import { exec } from 'sysopkit/op/exec';
import {
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
  waitFileContent,
  waitFilePath,
  writeFile,
} from 'sysopkit/op/file';
import { $_, sh } from 'sysopkit/op/sh';
import { tar, untar } from 'sysopkit/op/tar';

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

  test('createFile applies mode', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-mode-');
      await createFile({ path: p, content: 'x\n', mode: 0o600 });
      expect((await getFileStat(p)).mode).toBe(0o600);

      const t = trackChanged();
      await createFile({ path: p, content: 'x\n', mode: 0o644 });
      expect(t.changed).toBe(true);
      expect((await getFileStat(p)).mode).toBe(0o644);
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
      await createDir({ path: nested, recursive: true });
      expect(t.changed).toBe(true);
      expect((await getPathInfo(nested))?.type).toBe('dir');

      await deleteDir({ path: base, recursive: true });
      expect(await getPathInfo(base)).toBeUndefined();
    });
  });

  test('createLink / deleteLink round-trip', async () => {
    await sharedPodman(shared, async () => {
      const target = remoteTempPath('fs-target-');
      const link = remoteTempPath('fs-link-');
      await writeFile(target, 'target\n');
      const t = trackChanged();
      await createLink({ path: link, target });
      expect(t.changed).toBe(true);
      expect((await getPathInfo(link))?.type).toBe('link');
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

  test('waitFilePath resolves when file appears', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-wait-');
      await sh(`(sleep 0.3; echo ready > ${$_(p)}) &`);
      await waitFilePath({ path: p, delay: 50 });
      expect(await readFile(p)).toBe('ready\n');
    });
  });

  test('waitFileContent resolves when pattern appears', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('fs-wait-content-');
      await writeFile(p, 'booting\n');
      await sh(`(sleep 0.3; echo 'Server started' >> ${$_(p)}) &`);
      await waitFileContent({ path: p, regex: 'Server started', delay: 50 });
      expect((await readFile(p)).includes('Server started')).toBe(true);
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
});
