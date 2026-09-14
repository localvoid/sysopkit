import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { trackChanged } from '@sysopkit/test-utils';
import { exec } from 'sysopkit/op/exec';
import { createDir, getPathInfo, readFile, writeFile } from 'sysopkit/op/file';
import { sh } from 'sysopkit/op/sh';

import {
  remoteTempPath,
  sharedSsh,
  startSharedSshContainer,
  type Container,
} from '../container.js';

/**
 * SSH against OpenWrt's native dropbear server (no openssh-server).
 *
 * Deliberately dropbear-relevant only: `sh`/`exec` basics (exit codes,
 * stderr, stdin), root identity, file write/read, large output, multiplexing,
 * and dry-run. No `sudo` (no sudo user on OpenWrt), no `rsync` (no remote
 * rsync binary), no `getFileStat` (no GNU `stat`), no `whoami`/`bash`
 * (busybox only) — those stay on the parity suites.
 */
describe('SSHConnector (dropbear on openwrt)', () => {
  let shared: Container;

  beforeAll(async () => {
    shared = await startSharedSshContainer({ distro: 'openwrt' });
  });

  afterAll(async () => {
    if (shared) await shared.stop();
  });

  describe('sh', () => {
    test('executes command via SSH', async () => {
      await sharedSsh(shared, async () => {
        const { stdout, exitCode } = await exec(['echo', 'hello']);

        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe('hello');
      });
    });

    test('captures stderr via SSH', async () => {
      await sharedSsh(shared, async () => {
        const { stderr, exitCode } = await sh('echo error >&2');

        expect(exitCode).toBe(0);
        expect(stderr.trim()).toBe('error');
      });
    });

    test('returns non-zero exit code via SSH', async () => {
      await sharedSsh(shared, async () => {
        // `exec` (not `sh`): `sh()` throws ShellError outside exit 64-78.
        const { exitCode } = await exec(['sh', '-c', 'exit 3']);

        expect(exitCode).toBe(3);
      });
    });

    test('pipes stdin to process via SSH', async () => {
      await sharedSsh(shared, async () => {
        const input = 'test input data\n';
        const { stdout, exitCode } = await sh('cat', {
          stdin: new TextEncoder().encode(input),
        });

        expect(exitCode).toBe(0);
        expect(stdout).toBe(input);
      });
    });

    test('unknown command exits with 127', async () => {
      await sharedSsh(shared, async () => {
        const { exitCode } = await exec(['unknown']);

        expect(exitCode).toBe(127);
      });
    });

    test('transfers large output without truncation', async () => {
      await sharedSsh(shared, async () => {
        const { stdout, exitCode } = await sh('seq 1 1000');

        expect(exitCode).toBe(0);
        const lines = stdout.trim().split('\n');
        expect(lines.length).toBe(1000);
        expect(lines[0]).toBe('1');
        expect(lines[999]).toBe('1000');
      });
    });

    test('remote shell expands variables assigned in-command', async () => {
      await sharedSsh(shared, async () => {
        const { stdout, exitCode } = await sh('TEST_ENV_VALUE=dropbear-ok; echo $TEST_ENV_VALUE');

        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe('dropbear-ok');
      });
    });
  });

  describe('identity', () => {
    test('connects as root (no sudo user on openwrt)', async () => {
      await sharedSsh(shared, async () => {
        // `whoami` is not installed on OpenWrt; `id` is.
        const { stdout, exitCode } = await sh('id -un');

        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe('root');
      });
    });
  });

  describe('multiplexing', () => {
    test('runs sequential commands over one multiplexed connection', async () => {
      await sharedSsh(shared, async () => {
        const first = await exec(['echo', 'first']);
        const second = await exec(['echo', 'second']);

        expect(first.exitCode).toBe(0);
        expect(first.stdout.trim()).toBe('first');
        expect(second.exitCode).toBe(0);
        expect(second.stdout.trim()).toBe('second');
      });
    });

    test('connects without ControlMaster', async () => {
      await sharedSsh(
        shared,
        async () => {
          const { stdout, exitCode } = await exec(['echo', 'no-mux']);

          expect(exitCode).toBe(0);
          expect(stdout.trim()).toBe('no-mux');
        },
        { controlMaster: false },
      );
    });
  });

  describe('file operations', () => {
    test('writes and reads file', async () => {
      await sharedSsh(shared, async () => {
        const file = `${remoteTempPath('test-file-')}.txt`;
        await writeFile(file, 'test content\n');

        expect(await readFile(file)).toBe('test content\n');
        expect((await getPathInfo(file))?.type).toBe('file');
      });
    });

    test('creates directory', async () => {
      await sharedSsh(shared, async () => {
        const dir = `${remoteTempPath('test-dir-')}/nested/dir`;
        await createDir({ path: dir, recursive: true });

        expect((await getPathInfo(dir))?.type).toBe('dir');
      });
    });

    test('respects dry-run mode', async () => {
      await sharedSsh(
        shared,
        async () => {
          const dir = remoteTempPath('test-dryrun-');
          const tracker = trackChanged();
          await createDir({ path: dir });

          expect(tracker.changed).toBe(true);
          expect(await getPathInfo(dir)).toBeUndefined();
        },
        { dryRun: true },
      );
    });
  });
});
