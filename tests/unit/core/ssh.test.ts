import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { SSHConnector } from 'sysopkit/connector/ssh';

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
