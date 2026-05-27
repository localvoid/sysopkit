import { describe, expect, test } from 'bun:test';
import { mockSpawn, withMockContext } from '@sysopkit/test-utils';
import {
  sudo,
  SUDO_PASSWORD,
  SUDO_PRESERVE_ENV,
  SUDO_ROLE,
  SUDO_USER,
} from 'sysopkit/middleware/sudo';
import { spawn } from 'sysopkit/op/exec';

describe('sudo', () => {
  test('uses ctx.vars for user', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-u', 'ctxuser', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_USER]: 'ctxuser' } },
    );
  });

  test('explicit options override ctx.vars for user', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-u', 'explicituser', '-n', 'whoami'] }]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { user: 'explicituser' },
        );
      },
      { vars: { [SUDO_USER]: 'ctxuser' } },
    );
  });

  test('uses ctx.vars for password', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: expect.arrayContaining(['-S', '-p']), stderr: '', exitCode: 0 }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_PASSWORD]: 'ctxpassword' } },
    );
  });

  test('explicit password overrides ctx.vars', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [
          { cmd: expect.arrayContaining(['-S', '-p']), stderr: '', exitCode: 0 },
          { cmd: ['sudo', '-H', '-n', 'whoami'] },
        ]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { password: 'explicitpassword' },
        );
      },
      { vars: { [SUDO_PASSWORD]: 'ctxpassword' } },
    );
  });

  test('uses ctx.vars for preserveEnv boolean', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-E', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_PRESERVE_ENV]: true } },
    );
  });

  test('uses ctx.vars for preserveEnv array', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '--preserve-env=FOO,BAR', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_PRESERVE_ENV]: ['FOO', 'BAR'] } },
    );
  });

  test('explicit preserveEnv overrides ctx.vars', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '--preserve-env=EXPLICIT', '-n', 'whoami'] }]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { preserveEnv: ['EXPLICIT'] },
        );
      },
      { vars: { [SUDO_PRESERVE_ENV]: ['CTX'] } },
    );
  });

  test('uses ctx.vars for role', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-r', 'ctxrole', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_ROLE]: 'ctxrole' } },
    );
  });

  test('explicit role overrides ctx.vars', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-r', 'explicitrole', '-n', 'whoami'] }]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { role: 'explicitrole' },
        );
      },
      { vars: { [SUDO_ROLE]: 'ctxrole' } },
    );
  });
});
