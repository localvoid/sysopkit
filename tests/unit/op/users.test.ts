import { describe, expect, test } from 'bun:test';
import { mockSpawn, type MockSpawnSpec, trackChanged, withMockContext } from '@sysopkit/test-utils';
import { createGroup, createUser, GROUP_PATH, PASSWD_PATH } from 'sysopkit/op/users';

function mockPasswdFile(content: string): MockSpawnSpec {
  return { cmd: ['sh', '-c', `cat ${PASSWD_PATH}`], stdout: content, exitCode: 0 };
}

function mockGroupFile(content: string): MockSpawnSpec {
  return { cmd: ['sh', '-c', `cat ${GROUP_PATH}`], stdout: content, exitCode: 0 };
}

const EMPTY_PASSWD = 'root:x:0:0:root:/root:/bin/bash';
const EMPTY_GROUP = 'root:x:0:';

describe('createUser', () => {
  test('creates user when not exists', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [
        mockPasswdFile(EMPTY_PASSWD),
        { cmd: ['sh', '-c', 'useradd newuser'], exitCode: 0 },
      ]);

      await createUser({ user: 'newuser' });

      expect(tracker.changed).toBe(true);
    });
  });

  test('creates user with options', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockPasswdFile(EMPTY_PASSWD),
        { cmd: ['sh', '-c', 'useradd -u 2000 -s /bin/zsh newuser'], exitCode: 0 },
      ]);

      await createUser({ user: 'newuser', uid: 2000, shell: '/bin/zsh' });
    });
  });

  test('modifies existing user with uid', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [
        mockPasswdFile('testuser:x:1000:1000::/home/testuser:/bin/bash'),
        { cmd: ['sh', '-c', 'usermod -u 2000 testuser'], exitCode: 0 },
      ]);

      await createUser({ user: 'testuser', uid: 2000 });

      expect(tracker.changed).toBe(true);
    });
  });

  test('modifies existing user with shell', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockPasswdFile('testuser:x:1000:1000::/home/testuser:/bin/bash'),
        { cmd: ['sh', '-c', 'usermod -s /bin/zsh testuser'], exitCode: 0 },
      ]);

      await createUser({ user: 'testuser', shell: '/bin/zsh' });
    });
  });

  test('modifies existing user with gecos', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockPasswdFile('testuser:x:1000:1000:Old Name:/home/testuser:/bin/bash'),
        { cmd: ['sh', '-c', "usermod -c 'Test User' testuser"], exitCode: 0 },
      ]);

      await createUser({ user: 'testuser', gecos: 'Test User' });
    });
  });

  test('is idempotent when no changes needed', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [mockPasswdFile('testuser:x:1001:1000::/home/testuser:/bin/bash')]);

      await createUser({ user: 'testuser', uid: 1001 });

      expect(tracker.changed).toBe(false);
    });
  });

  test('reports change in dryRun when creating user', async () => {
    await withMockContext(
      async ({ conn }) => {
        const tracker = trackChanged();
        mockSpawn(conn, [mockPasswdFile(EMPTY_PASSWD)]);

        await createUser({ user: 'newuser' });

        expect(tracker.changed).toBe(true);
      },
      { dryRun: true },
    );
  });

  test('throws on usermod failure', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockPasswdFile('testuser:x:1000:1000::/home/testuser:/bin/bash'),
        {
          cmd: ['sh', '-c', 'usermod -u 2000 testuser'],
          exitCode: 1,
          stderr: 'usermod: UID 2000 already exists',
        },
      ]);

      try {
        await createUser({ user: 'testuser', uid: 2000 });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });
});

describe('createGroup', () => {
  test('creates group when not exists', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [
        mockGroupFile(EMPTY_GROUP),
        { cmd: ['sh', '-c', 'groupadd newgroup'], exitCode: 0 },
      ]);

      await createGroup({ name: 'newgroup' });

      expect(tracker.changed).toBe(true);
    });
  });

  test('creates group with members', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockGroupFile(EMPTY_GROUP),
        { cmd: ['sh', '-c', 'groupadd newgroup'], exitCode: 0 },
        { cmd: ['sh', '-c', 'gpasswd -M user1,user2 newgroup'], exitCode: 0 },
      ]);

      await createGroup({ name: 'newgroup', members: ['user1', 'user2'] });
    });
  });

  test('modifies existing group gid', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [
        mockGroupFile('sudo:x:27:'),
        { cmd: ['sh', '-c', 'groupmod -g 100 sudo'], exitCode: 0 },
      ]);

      await createGroup({ name: 'sudo', gid: 100 });

      expect(tracker.changed).toBe(true);
    });
  });

  test('adds and removes members', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockGroupFile('sudo:x:27:user1'),
        { cmd: ['sh', '-c', 'gpasswd -M user2,user3 sudo'], exitCode: 0 },
      ]);

      await createGroup({ name: 'sudo', members: ['user2', 'user3'] });
    });
  });

  test('skips when no changes needed', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [mockGroupFile('sudo:x:27:user1,user2')]);

      await createGroup({ name: 'sudo', gid: 27, members: ['user1', 'user2'] });

      expect(tracker.changed).toBe(false);
    });
  });

  test('reports change in dryRun when creating group', async () => {
    await withMockContext(
      async ({ conn }) => {
        const tracker = trackChanged();
        mockSpawn(conn, [mockGroupFile(EMPTY_GROUP)]);

        await createGroup({ name: 'newgroup' });

        expect(tracker.changed).toBe(true);
      },
      { dryRun: true },
    );
  });

  test('reports change in dryRun when modifying gid', async () => {
    await withMockContext(
      async ({ conn }) => {
        const tracker = trackChanged();
        mockSpawn(conn, [mockGroupFile('sudo:x:27:')]);

        await createGroup({ name: 'sudo', gid: 100 });

        expect(tracker.changed).toBe(true);
      },
      { dryRun: true },
    );
  });
});
