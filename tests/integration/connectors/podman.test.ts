import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tempDir } from '@sysopkit/test-utils';
import { sudo } from 'sysopkit/middleware/sudo';
import { exec } from 'sysopkit/op/exec';
import { getFileStat, getPathInfo, readFile, touchFile } from 'sysopkit/op/file';
import { rsyncPull, rsyncPush } from 'sysopkit/op/rsync';
import { sh } from 'sysopkit/op/sh';

import { withPodman } from '../container.js';
import {
  EXPECTED_FILES,
  RSYNC_FIXTURES,
  verifyRemoteFileNotExists,
  verifyRemoteFiles,
} from '../rsync.js';

describe('PodmanConnector', () => {
  describe('exec', () => {
    test('captures stdout', async () => {
      await withPodman(async () => {
        const { stdout, exitCode } = await exec(['echo', 'hello']);

        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe('hello');
      });
    });

    test('captures stderr', async () => {
      await withPodman(async () => {
        const { stderr, exitCode } = await sh('echo error >&2');

        expect(exitCode).toBe(0);
        expect(stderr.trim()).toBe('error');
      });
    });

    test('returns non-zero exit code for failed command', async () => {
      await withPodman(async () => {
        const { exitCode } = await sh('exit 64');

        expect(exitCode).toBe(64);
      });
    });

    test('pipes stdin to process', async () => {
      await withPodman(async () => {
        const stdin = 'test input data\n';
        const { stdout, exitCode } = await exec(['cat'], {
          stdin,
        });
        expect(exitCode).toBe(0);
        expect(stdout).toBe(stdin);
      });
    });
  });

  describe('sudo operations', () => {
    test('runs command as root via sudo', async () => {
      await withPodman(
        async () => {
          const { stdout } = await sh('whoami');
          expect(stdout.trim()).toBe('testuser');

          await sudo(
            async () => {
              const { stdout } = await sh('whoami');
              expect(stdout.trim()).toBe('root');
            },
            { password: 'testpasswd' },
          );
        },
        { user: 'testuser' },
      );
    });
  });

  describe('file operations', () => {
    test('creates and reads file', async () => {
      await withPodman(async () => {
        await sh("echo 'test content' > /tmp/test.txt");

        const { stdout } = await exec(['cat', '/tmp/test.txt']);
        expect(stdout.trim()).toBe('test content');
      });
    });

    test('creates directory', async () => {
      await withPodman(async () => {
        const { exitCode } = await exec(['mkdir', '-p', '/tmp/test/nested/dir']);
        expect(exitCode).toBe(0);

        const { exitCode: verifyCode } = await exec(['test', '-d', '/tmp/test/nested/dir']);
        expect(verifyCode).toBe(0);
      });
    });
  });

  describe('rsyncPush', () => {
    test('syncs all files to remote', async () => {
      await withPodman(async () => {
        const dst = '/tmp/rsync-push-basic';
        const result = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });

        expect(result).toEqual([
          {
            action: 'created',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'executable.sh',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file1.txt',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file2.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'symlink.txt',
            target: 'file1.txt',
            type: 'symlink',
          },
          {
            action: 'created',
            path: 'nested/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'nested/deep.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'subdir/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'subdir/item.txt',
            type: 'file',
          },
        ]);
        await verifyRemoteFiles(dst, EXPECTED_FILES);
      });
    });

    test('syncs nested directories', async () => {
      await withPodman(async () => {
        const dst = '/tmp/rsync-push-nested';
        const result = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });

        expect(result).toEqual([
          {
            action: 'created',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'executable.sh',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file1.txt',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file2.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'symlink.txt',
            target: 'file1.txt',
            type: 'symlink',
          },
          {
            action: 'created',
            path: 'nested/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'nested/deep.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'subdir/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'subdir/item.txt',
            type: 'file',
          },
        ]);

        expect(await getPathInfo(`${dst}/nested/deep.txt`)).toBeDefined();
        expect(await readFile(`${dst}/nested/deep.txt`)).toBe('nested-deep\n');
      });
    });

    test('preserves symlinks', async () => {
      await withPodman(async () => {
        const dst = '/tmp/rsync-push-symlink';
        const result = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });

        expect(result).toEqual([
          {
            action: 'created',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'executable.sh',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file1.txt',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file2.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'symlink.txt',
            target: 'file1.txt',
            type: 'symlink',
          },
          {
            action: 'created',
            path: 'nested/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'nested/deep.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'subdir/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'subdir/item.txt',
            type: 'file',
          },
        ]);

        const symlinkCheck = await exec(['test', '-L', `${dst}/symlink.txt`]);
        expect(symlinkCheck.exitCode).toBe(0);

        const target = await exec(['readlink', `${dst}/symlink.txt`]);
        expect(target.stdout.trim()).toBe('file1.txt');
      });
    });

    test('preserves executable permissions', async () => {
      await withPodman(async () => {
        const dst = '/tmp/rsync-push-perms';
        const result = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });

        expect(result).toEqual([
          {
            action: 'created',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'executable.sh',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file1.txt',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file2.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'symlink.txt',
            target: 'file1.txt',
            type: 'symlink',
          },
          {
            action: 'created',
            path: 'nested/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'nested/deep.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'subdir/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'subdir/item.txt',
            type: 'file',
          },
        ]);

        const s = await getFileStat(`${dst}/executable.sh`);
        expect(s.mode).toBe(0o755);
      });
    });

    test('deletes extraneous files with --delete', async () => {
      await withPodman(async () => {
        const dst = '/tmp/rsync-push-delete';

        await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });

        await touchFile({ path: `${dst}/extra.txt` });
        expect(await getPathInfo(`${dst}/extra.txt`)).toBeDefined();

        const result = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });

        expect(result).toEqual([
          {
            action: 'deleted',
            path: 'extra.txt',
          },
          {
            action: 'touched',
            path: './',
            type: 'directory',
          },
        ]);
        await verifyRemoteFileNotExists(dst, 'extra.txt');
      });
    });

    test('incremental update only transfers changed files', async () => {
      await withPodman(async () => {
        const dst = '/tmp/rsync-push-incremental';

        const result1 = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });
        expect(result1).toEqual([
          {
            action: 'created',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'executable.sh',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file1.txt',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file2.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'symlink.txt',
            target: 'file1.txt',
            type: 'symlink',
          },
          {
            action: 'created',
            path: 'nested/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'nested/deep.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'subdir/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'subdir/item.txt',
            type: 'file',
          },
        ]);

        const result2 = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });
        expect(result2).toEqual([]);
      });
    });

    test('respects dry-run mode', async () => {
      await withPodman(
        async () => {
          const dst = '/tmp/rsync-push-dryrun';
          const result = await rsyncPush({
            src: RSYNC_FIXTURES + '/',
            dst: dst + '/',
          });

          expect(result).toEqual([
            {
              action: 'created',
              path: './',
              type: 'directory',
            },
            {
              action: 'sent',
              path: 'executable.sh',
              type: 'file',
            },
            {
              action: 'sent',
              path: 'file1.txt',
              type: 'file',
            },
            {
              action: 'sent',
              path: 'file2.txt',
              type: 'file',
            },
            {
              action: 'created',
              path: 'symlink.txt',
              target: 'file1.txt',
              type: 'symlink',
            },
            {
              action: 'created',
              path: 'nested/',
              type: 'directory',
            },
            {
              action: 'sent',
              path: 'nested/deep.txt',
              type: 'file',
            },
            {
              action: 'created',
              path: 'subdir/',
              type: 'directory',
            },
            {
              action: 'sent',
              path: 'subdir/item.txt',
              type: 'file',
            },
          ]);

          const verify = await exec(['test', '-d', `${dst}`]);
          expect(verify.exitCode).not.toBe(0);
        },
        { dryRun: true },
      );
    });

    test('output contains itemize-changes format', async () => {
      await withPodman(async () => {
        const dst = '/tmp/rsync-push-output';
        const result = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });

        expect(result).toEqual([
          {
            action: 'created',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'executable.sh',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file1.txt',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file2.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'symlink.txt',
            target: 'file1.txt',
            type: 'symlink',
          },
          {
            action: 'created',
            path: 'nested/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'nested/deep.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'subdir/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'subdir/item.txt',
            type: 'file',
          },
        ]);
      });
    });
  });

  describe('rsyncPull', () => {
    test('pulls all files from container', async () => {
      await withPodman(async () => {
        const src = '/tmp/rsync-pull-src';
        await sh(`mkdir -p ${src}/nested`);
        await sh(`echo "content1" > ${src}/file1.txt`);
        await sh(`echo "content2" > ${src}/file2.txt`);
        await sh(`echo "nested content" > ${src}/nested/deep.txt`);

        await using tmp = await tempDir();
        const result = await rsyncPull({ src: src + '/', dst: tmp.path + '/' });

        expect(result).toEqual([
          {
            action: 'touched',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'file1.txt',
            type: 'file',
          },
          {
            action: 'sent',
            path: 'file2.txt',
            type: 'file',
          },
          {
            action: 'created',
            path: 'nested/',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'nested/deep.txt',
            type: 'file',
          },
        ]);

        expect(await fs.readFile(join(tmp.path, 'file1.txt'), 'utf8')).toBe('content1\n');
        expect(await fs.readFile(join(tmp.path, 'file2.txt'), 'utf8')).toBe('content2\n');
        expect(await fs.readFile(join(tmp.path, 'nested/deep.txt'), 'utf8')).toBe(
          'nested content\n',
        );
      });
    });

    test('pulls symlinks from container', async () => {
      await withPodman(async () => {
        const src = '/tmp/rsync-pull-symlink';
        await sh(`mkdir -p ${src}`);
        await sh(`echo "target" > ${src}/target.txt`);
        await sh(`ln -s target.txt ${src}/link.txt`);

        await using tmp = await tempDir();
        const result = await rsyncPull({ src: src + '/', dst: tmp.path + '/' });

        expect(result).toEqual([
          {
            action: 'touched',
            path: './',
            type: 'directory',
          },
          {
            action: 'created',
            path: 'link.txt',
            target: 'target.txt',
            type: 'symlink',
          },
          {
            action: 'sent',
            path: 'target.txt',
            type: 'file',
          },
        ]);

        const stat = await fs.lstat(join(tmp.path, 'link.txt'));
        expect(stat.isSymbolicLink()).toBe(true);
      });
    });

    test('respects dry-run mode', async () => {
      await withPodman(
        async () => {
          const src = '/tmp/rsync-pull-dry-src';
          await exec(['mkdir', '-p', src]);
          await sh(`echo "test" > ${src}/file.txt`);

          await using tmp = await tempDir();
          const result = await rsyncPull({ src: src + '/', dst: tmp.path + '/' });

          expect(result).toEqual([
            {
              action: 'touched',
              path: './',
              type: 'directory',
            },
            {
              action: 'sent',
              path: 'file.txt',
              type: 'file',
            },
          ]);

          expect(async () => {
            await fs.stat(join(tmp.path, 'file.txt'));
          }).toThrow();
        },
        { dryRun: true },
      );
    });

    test('output contains itemize-changes format', async () => {
      await withPodman(async () => {
        const src = '/tmp/rsync-pull-output';
        await exec(['mkdir', '-p', src]);
        await sh(`echo "content" > ${src}/file.txt`);

        await using tmp = await tempDir();
        const result = await rsyncPull({ src: src + '/', dst: tmp.path + '/' });

        expect(result).toEqual([
          {
            action: 'touched',
            path: './',
            type: 'directory',
          },
          {
            action: 'sent',
            path: 'file.txt',
            type: 'file',
          },
        ]);
      });
    });
  });
});
