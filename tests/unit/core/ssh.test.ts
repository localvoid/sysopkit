import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { SSHConnector, removeKnownHost } from 'sysopkit/connector/ssh';

let tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tmpDirs = [];
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/**
 * Installs a fake `ssh` executable that fails silently on the normal probe
 * but prints diagnostics when invoked with LogLevel=VERBOSE, then runs
 * `connect()` with that fake first on PATH.
 */
async function connectWithFakeSsh(key: string): Promise<Error> {
  const dir = await makeTempDir('sysopkit-fake-ssh-');
  const fakeSsh = join(dir, 'ssh');
  await fs.writeFile(
    fakeSsh,
    '#!/bin/sh\nfor arg in "$@"; do\n  if [ "$arg" = "LogLevel=VERBOSE" ]; then\n    echo "debug1: Offering public key: fake-key" >&2\n    echo "debug1: Authentications that can continue: publickey" >&2\n    exit 255\n  fi\ndone\nexit 255\n',
  );
  await fs.chmod(fakeSsh, 0o700);
  const conn = new SSHConnector({
    host: 'localhost',
    user: 'testuser',
    key,
    strictHostKeyChecking: false,
    controlMaster: false,
    timeout: 2,
  });
  conn.env = { ...process.env, PATH: `${dir}:${process.env['PATH'] ?? ''}` };
  try {
    await conn.connect();
    expect.unreachable();
  } catch (e) {
    return e as Error;
  } finally {
    await conn[Symbol.asyncDispose]();
  }
  expect.unreachable();
}

describe('SSHConnector connect', () => {
  test('rejects group-readable private key with remediation hint', async () => {
    const dir = await makeTempDir('sysopkit-key-');
    const key = join(dir, 'id_key');
    await fs.writeFile(key, 'fake-key-bytes');
    await fs.chmod(key, 0o644);
    const conn = new SSHConnector({ host: 'localhost', user: 'testuser', key });
    try {
      await conn.connect();
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('has mode 644');
      expect((e as Error).message).toContain('chmod 600');
    } finally {
      await conn[Symbol.asyncDispose]();
    }
  });

  test('rejects missing key file', async () => {
    const conn = new SSHConnector({ host: 'localhost', user: 'testuser', key: '/nonexistent-key' });
    try {
      await conn.connect();
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('not accessible');
    } finally {
      await conn[Symbol.asyncDispose]();
    }
  });

  test('silent probe failure appends verbose diagnostics', async () => {
    const dir = await makeTempDir('sysopkit-key-');
    const key = join(dir, 'id_key');
    await fs.writeFile(key, 'fake-key-bytes');
    await fs.chmod(key, 0o600);
    const error = await connectWithFakeSsh(key);
    expect(error.message).toContain("connect failed with exit code '255'");
    expect(error.message).toContain('[verbose retry exit 255]');
    expect(error.message).toContain('Offering public key');
  });
});

describe('SSHConnector strict host key checking', () => {
  function hasLaxFlags(rsh: string[]): boolean {
    return rsh.includes('StrictHostKeyChecking=no') && rsh.includes('UserKnownHostsFile=/dev/null');
  }

  test('strict by default, lax after downgrade with cache invalidation', async () => {
    const conn = new SSHConnector({ host: 'localhost', user: 'testuser', controlMaster: false });
    try {
      expect(conn.strictHostKeyChecking).toBeUndefined();
      expect(hasLaxFlags(conn.rsh)).toBe(false);
      // Populate the cached rsh, then downgrade must drop the stale entry.
      void conn.rsh;
      conn.disableStrictHostKeyChecking();
      expect(conn.strictHostKeyChecking).toBe(false);
      expect(hasLaxFlags(conn.rsh)).toBe(true);
    } finally {
      await conn[Symbol.asyncDispose]();
    }
  });

  test('downgrade matches strict:false construction', async () => {
    const downgraded = new SSHConnector({
      host: 'localhost',
      user: 'testuser',
      controlMaster: false,
    });
    const constructed = new SSHConnector({
      host: 'localhost',
      user: 'testuser',
      controlMaster: false,
      strictHostKeyChecking: false,
    });
    try {
      downgraded.disableStrictHostKeyChecking();
      expect(downgraded.rsh).toEqual(constructed.rsh);
    } finally {
      await downgraded[Symbol.asyncDispose]();
      await constructed[Symbol.asyncDispose]();
    }
  });

  test('disable is idempotent', async () => {
    const conn = new SSHConnector({ host: 'localhost', user: 'testuser', controlMaster: false });
    try {
      conn.disableStrictHostKeyChecking();
      conn.disableStrictHostKeyChecking();
      expect(conn.strictHostKeyChecking).toBe(false);
      expect(hasLaxFlags(conn.rsh)).toBe(true);
    } finally {
      await conn[Symbol.asyncDispose]();
    }
  });

  test('downgrade applies without an ambient context', async () => {
    const conn = new SSHConnector({ host: 'localhost', user: 'testuser', controlMaster: false });
    try {
      conn.disableStrictHostKeyChecking();
      expect(conn.strictHostKeyChecking).toBe(false);
      expect(hasLaxFlags(conn.rsh)).toBe(true);
    } finally {
      await conn[Symbol.asyncDispose]();
    }
  });
});

describe('removeKnownHost', () => {
  test('removes matching entries from the given file', async () => {
    const dir = await makeTempDir('sysopkit-known-hosts-');
    const file = join(dir, 'known_hosts');
    await fs.writeFile(
      file,
      '192.168.122.95 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI95\n192.168.122.96 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI96\n',
    );

    await removeKnownHost('192.168.122.95', file);

    const rest = await fs.readFile(file, 'utf8');
    expect(rest).not.toContain('192.168.122.95');
    expect(rest).toContain('192.168.122.96');
  });

  test('missing entry still succeeds', async () => {
    const dir = await makeTempDir('sysopkit-known-hosts-');
    const file = join(dir, 'known_hosts');
    await fs.writeFile(file, '192.168.122.96 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI96\n');

    await removeKnownHost('192.168.122.95', file);

    expect(await fs.readFile(file, 'utf8')).toContain('192.168.122.96');
  });

  test('refuses empty or blank host', async () => {
    for (const host of ['', 'a b']) {
      let err: unknown;
      try {
        await removeKnownHost(host);
      } catch (e) {
        err = e;
      }
      expect(String(err)).toContain('refusing');
    }
  });
});
