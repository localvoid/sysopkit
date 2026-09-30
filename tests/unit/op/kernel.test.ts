import { describe, expect, test } from 'bun:test';
import { _kexecExecCmd, KEXEC_LOADED_PATH, kexecExec, kexecLoad } from '@sysopkit/linux/kernel';
import { getSpawnCalls, mockSpawn, withMockContext } from '@sysopkit/test-utils';

// kexec is excluded from e2e (no host kernel in containers), so behavior is
// covered here with unit mocks. Command-string assertions are the sanctioned
// approach for this excluded category.

const LOADED_READ_CMD = ['sh', '-c', `p=${KEXEC_LOADED_PATH};[ -f "$p" ]||exit 64;cat "$p"`];

function loadedSpec(stdout: string) {
  return { cmd: LOADED_READ_CMD, stdout };
}

function missingLoadedSpec() {
  return { cmd: LOADED_READ_CMD, stdout: '', exitCode: 64 };
}

describe('_kexecExecCmd', () => {
  test('foreground runs kexec -e directly', () => {
    expect(_kexecExecCmd(false, 3)).toBe('kexec -e');
  });

  test('detached backgrounds with delay and detached fds', () => {
    expect(_kexecExecCmd(true, 3)).toBe('(sleep 3; kexec -e) </dev/null >/dev/null 2>&1 &');
  });

  test('detached honors custom delay', () => {
    expect(_kexecExecCmd(true, 10)).toBe('(sleep 10; kexec -e) </dev/null >/dev/null 2>&1 &');
  });

  test('detached with zero delay execs immediately in background', () => {
    expect(_kexecExecCmd(true, 0)).toBe('kexec -e </dev/null >/dev/null 2>&1 &');
  });
});

describe('kexecExec', () => {
  test('detaches by default after loaded check', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        loadedSpec('1\n'),
        { cmd: ['sh', '-c', '(sleep 3; kexec -e) </dev/null >/dev/null 2>&1 &'] },
      ]);

      await kexecExec();

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('foreground with detach:false runs kexec -e directly', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [loadedSpec('1\n'), { cmd: ['sh', '-c', 'kexec -e'] }]);

      await kexecExec({ detach: false });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('honors custom delaySec', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        loadedSpec('1\n'),
        { cmd: ['sh', '-c', '(sleep 10; kexec -e) </dev/null >/dev/null 2>&1 &'] },
      ]);

      await kexecExec({ delaySec: 10 });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('refuses when no kernel is loaded', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [loadedSpec('0\n')]);

      try {
        await kexecExec();
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('no kernel loaded');
      }
    });
  });

  test('refuses when the loaded flag file is missing', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [missingLoadedSpec()]);

      try {
        await kexecExec();
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('no kernel loaded');
      }
    });
  });

  test('skipLoadedCheck bypasses the flag read', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [{ cmd: ['sh', '-c', '(sleep 3; kexec -e) </dev/null >/dev/null 2>&1 &'] }]);

      await kexecExec({ skipLoadedCheck: true });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('refuses negative delaySec', async () => {
    await withMockContext(async () => {
      try {
        await kexecExec({ delaySec: -1 });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('delaySec');
      }
    });
  });

  test('refuses non-finite delaySec', async () => {
    await withMockContext(async () => {
      try {
        await kexecExec({ delaySec: Number.NaN });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('delaySec');
      }
    });
  });

  test('refuses delaySec without detach', async () => {
    await withMockContext(async () => {
      try {
        await kexecExec({ detach: false, delaySec: 3 });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('detach');
      }
    });
  });

  test('dry-run performs no spawns', async () => {
    await withMockContext(
      async ({ conn }) => {
        await kexecExec();
        expect(getSpawnCalls(conn)).toHaveLength(0);
      },
      { dryRun: true },
    );
  });
});

describe('kexecLoad', () => {
  test('loads with kernel, initrd, and cmdline', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        {
          cmd: ['sh', '-c', `kexec -l /boot/vmlinuz '--initrd=/boot/initrd.img' '--append=quiet'`],
        },
      ]);

      await kexecLoad({
        kernel: '/boot/vmlinuz',
        initrd: '/boot/initrd.img',
        cmdline: 'quiet',
      });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('selects the file syscall with -s', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [{ cmd: ['sh', '-c', 'kexec -s -l /boot/vmlinuz'] }]);

      await kexecLoad({ kernel: '/boot/vmlinuz', syscall: 'file' });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('selects the load syscall with -c', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [{ cmd: ['sh', '-c', 'kexec -c -l /boot/vmlinuz'] }]);

      await kexecLoad({ kernel: '/boot/vmlinuz', syscall: 'load' });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('refuses without kernel', async () => {
    await withMockContext(async () => {
      try {
        await kexecLoad({ kernel: '' });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('kernel is required');
      }
    });
  });

  test('refuses invalid syscall', async () => {
    await withMockContext(async () => {
      try {
        await kexecLoad({ kernel: '/boot/vmlinuz', syscall: 'bogus' as never });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('syscall');
      }
    });
  });

  test('dry-run performs no spawns', async () => {
    await withMockContext(
      async ({ conn }) => {
        await kexecLoad({ kernel: '/boot/vmlinuz' });
        expect(getSpawnCalls(conn)).toHaveLength(0);
      },
      { dryRun: true },
    );
  });
});
