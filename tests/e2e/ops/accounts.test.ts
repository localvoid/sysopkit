import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { trackChanged } from '@sysopkit/test-utils';
import { exec } from 'sysopkit/op/exec';
import { readFile } from 'sysopkit/op/file';
import { $_, sh } from 'sysopkit/op/sh';
import {
  createGroup,
  createUser,
  deleteGroup,
  deleteUser,
  getCurrentUser,
  parseGroupFile,
  parsePasswdFile,
  GROUP_PATH,
  PASSWD_PATH,
} from 'sysopkit/op/users';

import {
  remoteTempPath,
  sharedPodman,
  startSharedContainer,
  type Container,
} from '../container.js';

function uniqueName(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`.toLowerCase();
}

describe('accounts ops', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'redhat', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('getCurrentUser reports root in container', async () => {
    await sharedPodman(shared, async () => {
      const me = await getCurrentUser();
      expect(me.name).toBe('root');
      expect(me.uid).toBe(0);
    });
  });

  test('createUser creates user visible via id and /etc/passwd', async () => {
    await sharedPodman(shared, async () => {
      const user = uniqueName('tku-');
      const t = trackChanged();
      await createUser({ user });
      expect(t.changed).toBe(true);

      const { stdout, exitCode } = await exec(['id', user]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain(user);

      const users = parsePasswdFile(await readFile(PASSWD_PATH));
      expect(users.some((u) => u.user === user)).toBe(true);

      const t2 = trackChanged();
      await createUser({ user });
      expect(t2.changed).toBe(false);

      await deleteUser({ user });
      const after = parsePasswdFile(await readFile(PASSWD_PATH));
      expect(after.some((u) => u.user === user)).toBe(false);
    });
  });

  test('createUser with shell and gecos, then modifies them', async () => {
    await sharedPodman(shared, async () => {
      const user = uniqueName('tku-');
      await createUser({ user, shell: '/bin/bash', gecos: 'First Name' });
      let users = parsePasswdFile(await readFile(PASSWD_PATH));
      expect(users.find((u) => u.user === user)?.gecos).toBe('First Name');

      const t = trackChanged();
      await createUser({ user, shell: '/bin/sh', gecos: 'Second Name' });
      expect(t.changed).toBe(true);
      users = parsePasswdFile(await readFile(PASSWD_PATH));
      expect(users.find((u) => u.user === user)?.shell).toBe('/bin/sh');
      expect(users.find((u) => u.user === user)?.gecos).toBe('Second Name');

      await deleteUser({ user });
    });
  });

  test('createUser reports change in dry-run without creating', async () => {
    await sharedPodman(
      shared,
      async () => {
        const user = uniqueName('tku-dry-');
        const t = trackChanged();
        await createUser({ user });
        expect(t.changed).toBe(true);
        const { exitCode } = await exec(['id', user]);
        expect(exitCode).not.toBe(0);
      },
      { dryRun: true },
    );
  });

  test('deleteUser is idempotent for missing user', async () => {
    await sharedPodman(shared, async () => {
      const user = uniqueName('tku-missing-');
      const t = trackChanged();
      await deleteUser({ user });
      expect(t.changed).toBe(false);
    });
  });

  test('createGroup creates group with members, then updates', async () => {
    await sharedPodman(shared, async () => {
      const group = uniqueName('tkg-');
      const m1 = uniqueName('tkm-');
      const m2 = uniqueName('tkm-');
      const m3 = uniqueName('tkm-');
      await createUser({ user: m1 });
      await createUser({ user: m2 });
      await createUser({ user: m3 });

      const t = trackChanged();
      await createGroup({ name: group, members: [m1, m2] });
      expect(t.changed).toBe(true);

      let groups = parseGroupFile(await readFile(GROUP_PATH));
      expect(groups.find((g) => g.name === group)?.members.sort()).toEqual([m1, m2].sort());

      const t2 = trackChanged();
      await createGroup({ name: group, members: [m2, m3] });
      expect(t2.changed).toBe(true);
      groups = parseGroupFile(await readFile(GROUP_PATH));
      expect(groups.find((g) => g.name === group)?.members.sort()).toEqual([m2, m3].sort());

      const t3 = trackChanged();
      await createGroup({ name: group, members: [m2, m3] });
      expect(t3.changed).toBe(false);

      await deleteGroup({ name: group });
      groups = parseGroupFile(await readFile(GROUP_PATH));
      expect(groups.some((g) => g.name === group)).toBe(false);

      await deleteUser({ user: m1 });
      await deleteUser({ user: m2 });
      await deleteUser({ user: m3 });
    });
  });

  test('createGroup reports change in dry-run without creating', async () => {
    await sharedPodman(
      shared,
      async () => {
        const group = uniqueName('tkg-dry-');
        const t = trackChanged();
        await createGroup({ name: group });
        expect(t.changed).toBe(true);
        const { exitCode } = await sh(`getent group ${$_(group)}||exit 64`);
        expect(exitCode).toBe(64);
      },
      { dryRun: true },
    );
  });

  test('deleteGroup is idempotent for missing group', async () => {
    await sharedPodman(shared, async () => {
      const group = uniqueName('tkg-missing-');
      const t = trackChanged();
      await deleteGroup({ name: group });
      expect(t.changed).toBe(false);
    });
  });

  test('new user home dir is isolated via remoteTempPath', async () => {
    await sharedPodman(shared, async () => {
      const user = uniqueName('tku-');
      const home = remoteTempPath('tku-home-');
      await createUser({ user, home });
      const users = parsePasswdFile(await readFile(PASSWD_PATH));
      expect(users.find((u) => u.user === user)?.home).toBe(home);
      await deleteUser({ user });
    });
  });
});
