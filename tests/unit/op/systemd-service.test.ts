import { describe, expect, test } from 'bun:test';
import {
  disableService,
  enableService,
  reloadService,
  restartService,
  startService,
  stopService,
} from '@sysopkit/linux/systemd';
import { mockSpawn, withMockContext, type MockContext } from '@sysopkit/test-utils';
import { CHANGE_EVENT, type ChangeEntry } from 'sysopkit';

// Daemon-control scope: no systemd PID1 in containers, so behavior
// (batching, filtering, change events) is covered here with mocks.
// See tests/AGENTS.md excluded list.

const SHOW_PROPS = ' --property=LoadState,ActiveState,SubState,UnitFileState,MainPID';

function showStdout(opts: { load?: string; active?: string; file?: string }): string {
  const { load = 'loaded', active = 'active', file = 'enabled' } = opts;
  return `LoadState=${load}\nActiveState=${active}\nSubState=running\nUnitFileState=${file}\nMainPID=123\n`;
}

function mockShow(unit: string, opts?: { load?: string; active?: string; file?: string }) {
  return {
    cmd: ['sh', '-c', `systemctl --no-pager show ${unit}${SHOW_PROPS}`],
    stdout: showStdout(opts ?? {}),
  };
}

function mockAction(cmd: string) {
  return { cmd: ['sh', '-c', cmd] };
}

function changedEntries(mock: MockContext): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  const calls = mock.reporter.onEvent.mock.calls as unknown as [unknown, unknown, unknown][];
  for (const [, event, data] of calls) {
    if (event === CHANGE_EVENT) {
      if (Array.isArray(data)) out.push(...(data as ChangeEntry[]));
      else out.push(data as ChangeEntry);
    }
  }
  return out;
}

describe('startService', () => {
  test('single name returns boolean', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { active: 'inactive', file: 'enabled' }),
        mockAction('systemctl start a.service'),
      ]);
      const changed = await startService({ name: 'a.service' });
      expect(changed).toBe(true);
      expect(changedEntries(mock).map((e) => e.resource)).toEqual(['a.service']);
    });
  });

  test('batches only units needing start, returns positional booleans', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { active: 'inactive', file: 'enabled' }),
        mockShow('b.service', { active: 'active', file: 'enabled' }),
        mockShow('c.service', { active: 'failed', file: 'enabled' }),
        mockAction('systemctl start a.service c.service'),
      ]);
      const changed = await startService({ name: ['a.service', 'b.service', 'c.service'] });
      expect(changed).toEqual([true, false, true]);
      expect(
        changedEntries(mock)
          .map((e) => e.resource)
          .sort(),
      ).toEqual(['a.service', 'c.service']);
    });
  });

  test('no-op when all running issues no action call', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { active: 'active' }),
        mockShow('b.service', { active: 'active' }),
      ]);
      const changed = await startService({ name: ['a.service', 'b.service'] });
      expect(changed).toEqual([false, false]);
      expect(changedEntries(mock)).toEqual([]);
    });
  });

  test('dry-run reports change without action call', async () => {
    await withMockContext(
      async (mock) => {
        mockSpawn(mock.conn, [mockShow('a.service', { active: 'inactive' })]);
        const changed = await startService({ name: ['a.service'] });
        expect(changed).toEqual([true]);
        expect(changedEntries(mock).map((e) => e.resource)).toEqual(['a.service']);
      },
      { dryRun: true },
    );
  });
});

describe('enableService / disableService', () => {
  test('enable batches only disabled units', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { file: 'enabled' }),
        mockShow('b.service', { file: 'disabled' }),
        mockAction('systemctl enable b.service'),
      ]);
      await enableService({ name: ['a.service', 'b.service'] });
      expect(changedEntries(mock).map((e) => e.resource)).toEqual(['b.service']);
    });
  });

  test('disable batches only enabled units', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { file: 'enabled' }),
        mockShow('b.service', { file: 'disabled' }),
        mockAction('systemctl disable a.service'),
      ]);
      await disableService({ name: ['a.service', 'b.service'] });
      expect(changedEntries(mock).map((e) => e.resource)).toEqual(['a.service']);
    });
  });

  test('user scope batches with --user flag', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        {
          cmd: ['sh', '-c', `systemctl --no-pager --user show a.service${SHOW_PROPS}`],
          stdout: showStdout({ file: 'disabled' }),
        },
        {
          cmd: ['sh', '-c', `systemctl --no-pager --user show b.service${SHOW_PROPS}`],
          stdout: showStdout({ file: 'disabled' }),
        },
        mockAction('systemctl --user enable a.service b.service'),
      ]);
      await enableService({ name: ['a.service', 'b.service'], scope: 'user' });
      expect(
        changedEntries(mock)
          .map((e) => e.resource)
          .sort(),
      ).toEqual(['a.service', 'b.service']);
    });
  });
});

describe('stopService / restartService / reloadService', () => {
  test('stop batches active units in one call', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { active: 'active' }),
        mockShow('b.service', { active: 'inactive' }),
        mockShow('c.service', { active: 'failed' }),
        mockAction('systemctl stop a.service c.service'),
      ]);
      await stopService({ name: ['a.service', 'b.service', 'c.service'] });
      expect(
        changedEntries(mock)
          .map((e) => e.resource)
          .sort(),
      ).toEqual(['a.service', 'c.service']);
    });
  });

  test('restart skips unloaded units', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { load: 'loaded' }),
        mockShow('b.service', { load: 'not-found' }),
        mockAction('systemctl restart a.service'),
      ]);
      await restartService({ name: ['a.service', 'b.service'] });
      expect(changedEntries(mock).map((e) => e.resource)).toEqual(['a.service']);
    });
  });

  test('reload batches loaded units in one call', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [
        mockShow('a.service', { load: 'loaded' }),
        mockShow('b.service', { load: 'merged' }),
        mockAction('systemctl reload a.service b.service'),
      ]);
      await reloadService({ name: ['a.service', 'b.service'] });
      expect(
        changedEntries(mock)
          .map((e) => e.resource)
          .sort(),
      ).toEqual(['a.service', 'b.service']);
    });
  });
});

describe('validation inside task frame', () => {
  test('refuses empty unit list', async () => {
    await withMockContext(async (mock) => {
      try {
        await startService({ name: [] });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('refusing: unit name is required');
      }
      const taskErr = mock.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
    });
  });

  test('refuses bad unit names', async () => {
    await withMockContext(async (mock) => {
      try {
        await stopService({ name: ['a.service', ''] });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("refusing: bad unit name ''");
      }
      const taskErr = mock.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
    });
  });
});
