import { describe, expect, test } from 'bun:test';
import {
  _kexecExecCmd,
  kexecExec,
  kexecLoad,
  parseDmesgOutput,
  parseLsmodOutput,
  parseModinfoResults,
} from '@sysopkit/linux/kernel';
import { withMockContext } from '@sysopkit/test-utils';

// kexec is excluded from e2e (no host kernel in containers), so only pure
// parsing/serialization plus input validation is covered here. Command
// execution behavior (mockSpawn cmd arrays, getSpawnCalls counts) is NOT
// asserted in unit tests per tests/AGENTS.md; real mount/kexec behavior
// is covered in e2e with final remote state.

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

describe('parseDmesgOutput', () => {
  test('parses JSON output', () => {
    const stdout = JSON.stringify([
      { facility: 'kern', level: 'err', timestamp: 1.5, message: 'oops' },
      { facility: 'kern', priority: 'warn', timestamp: 2, msg: 'careful' },
    ]);
    expect(parseDmesgOutput(stdout)).toEqual([
      { facility: 'kern', level: 'err', timestamp: 1.5, message: 'oops' },
      { facility: 'kern', level: 'warn', timestamp: 2, message: 'careful' },
    ]);
  });

  test('returns empty for non-array JSON', () => {
    expect(parseDmesgOutput(JSON.stringify({ foo: 'bar' }))).toEqual([]);
  });

  test('falls back to plain text lines', () => {
    expect(parseDmesgOutput('line one\n\nline two\n')).toEqual([
      { facility: 'kern', level: 'info', timestamp: 0, message: 'line one' },
      { facility: 'kern', level: 'info', timestamp: 0, message: 'line two' },
    ]);
  });
});

describe('parseLsmodOutput', () => {
  test('parses /proc/modules lines', () => {
    const raw = 'ext4 123456 2 - Live 0x0\nnvidia 999 0 nvidia_modeset,nvidia_uvm Live 0x0\n';
    expect(parseLsmodOutput(raw)).toEqual([
      { module: 'ext4', size: 123456, usedBy: [], count: 2 },
      { module: 'nvidia', size: 999, usedBy: ['nvidia_modeset', 'nvidia_uvm'], count: 0 },
    ]);
  });

  test('skips short lines and trims blanks', () => {
    expect(parseLsmodOutput('\nfoo\nbar 1 2 -\n')).toEqual([
      { module: 'bar', size: 1, usedBy: [], count: 2 },
    ]);
  });
});

describe('parseModinfoResults', () => {
  test('splits alias, depends, and parm fields', () => {
    const info = parseModinfoResults({
      filename: '/lib/modules/x.ko',
      license: 'GPL',
      description: 'desc',
      author: 'auth',
      alias: 'alias-a\nalias-b\n',
      depends: 'dep-a, dep-b',
      parm: 'opt: description\nflag:toggle\n',
    });
    expect(info.alias).toEqual(['alias-a', 'alias-b']);
    expect(info.depends).toEqual(['dep-a', 'dep-b']);
    expect(info.parm).toEqual({ opt: 'description', flag: 'toggle' });
    expect(info.filename).toBe('/lib/modules/x.ko');
  });
});

describe('kexecExec validation', () => {
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
});

describe('kexecLoad validation', () => {
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
});
