import { describe, expect, test } from 'bun:test';
import { withMockContext } from '@sysopkit/test-utils';
import { createUser } from 'sysopkit/op/users';

describe('createUser validation', () => {
  test('refuses bad user names inside the task context', async () => {
    await withMockContext(async (mock) => {
      try {
        await createUser({ user: 'bad name!' });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("refusing: bad user name 'bad name!'");
      }
      // The refusal must be reported against the task frame so reporter
      // output shows which op rejected the input.
      const taskErr = mock.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
      expect(taskErr![0].name).toBe('create user bad name!');
    });
  });

  test('refuses bad group names inside the task context', async () => {
    await withMockContext(async (mock) => {
      try {
        await createUser({ user: 'validuser', groups: ['bad group!'] });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("refusing: bad group name 'bad group!'");
      }
      const taskErr = mock.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
      expect(taskErr![0].name).toBe('create user validuser');
    });
  });
});
