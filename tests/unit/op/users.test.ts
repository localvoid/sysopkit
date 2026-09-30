import { describe, expect, test } from 'bun:test';
import { withMockContext } from '@sysopkit/test-utils';
import { createUser, parseGroupFile, parsePasswdFile } from 'sysopkit/op/users';

// Unit scope: pure parsing (parsePasswdFile/parseGroupFile, no connector)
// plus input validation inside the task frame. Command execution behavior
// (useradd/usermod idempotency, dry-run) is covered in
// tests/e2e/ops/accounts.test.ts with final remote state.

describe('parsePasswdFile', () => {
  test('parses user entries', () => {
    const result = parsePasswdFile(
      'root:x:0:0:root:/root:/bin/bash\napp:x:1001:1001::/home/app:/bin/sh\n',
    );
    expect(result).toEqual([
      { user: 'root', uid: 0, gid: 0, gecos: 'root', home: '/root', shell: '/bin/bash' },
      { user: 'app', uid: 1001, gid: 1001, gecos: '', home: '/home/app', shell: '/bin/sh' },
    ]);
  });

  test('rejects short lines', () => {
    try {
      parsePasswdFile('badline\n');
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('invalid user entry on line 1');
    }
  });
});

describe('parseGroupFile', () => {
  test('parses group entries with members', () => {
    const result = parseGroupFile('wheel:x:10:alice,bob\nnogroup:x:65534:\n');
    expect(result).toEqual([
      { name: 'wheel', gid: 10, members: ['alice', 'bob'] },
      { name: 'nogroup', gid: 65534, members: [] },
    ]);
  });

  test('rejects short lines', () => {
    try {
      parseGroupFile('badline\n');
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('invalid group entry on line 1');
    }
  });
});

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
