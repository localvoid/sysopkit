import { afterEach, describe, expect, mock, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { MockConnector, withMockContext } from '@sysopkit/test-utils';
import { AbortError, isAbortError, TimeoutError, waitForReady } from 'sysopkit';
import { LocalConnector } from 'sysopkit/connector/local';
import { PodmanConnector } from 'sysopkit/connector/podman';
import { SSHConnector } from 'sysopkit/connector/ssh';

let tmpDirs: string[] = [];
const realPath = process.env['PATH'];

afterEach(async () => {
  process.env['PATH'] = realPath;
  await Promise.all(tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tmpDirs = [];
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

async function sysopkitTmpEntries(): Promise<string[]> {
  const entries = await fs.readdir(os.tmpdir());
  return entries.filter((e) => e.startsWith('sysopkit-ssh-')).sort();
}

async function installFakeSsh(
  script: string,
  extraEnv?: Record<string, string>,
): Promise<{ dir: string; env: NodeJS.ProcessEnv }> {
  const dir = await makeTempDir('sysopkit-fake-ssh-');
  await fs.writeFile(join(dir, 'ssh'), script);
  await fs.chmod(join(dir, 'ssh'), 0o700);
  return { dir, env: { ...process.env, PATH: `${dir}:${process.env['PATH'] ?? ''}`, ...extraEnv } };
}

async function installFakePodman(script: string): Promise<string> {
  const dir = await makeTempDir('sysopkit-fake-podman-');
  await fs.writeFile(join(dir, 'podman'), script);
  await fs.chmod(join(dir, 'podman'), 0o700);
  process.env['PATH'] = `${dir}:${realPath ?? ''}`;
  return dir;
}

describe('waitForReady', () => {
  test('resolves on false-to-true transition', async () => {
    await withMockContext(async () => {
      const conn = new MockConnector('mock-host', 'mock', void 0);
      let calls = 0;
      conn.isReady = mock(async () => (++calls >= 3 ? true : false));
      await waitForReady(conn, { timeoutMs: 1000, intervalMs: 10 });
      expect(calls).toBe(3);
    });
  });

  test('throws TimeoutError with host and budget on burn', async () => {
    await withMockContext(async (mockCtx) => {
      const conn = new MockConnector('mock-host', 'mock', void 0);
      let calls = 0;
      conn.isReady = mock(async () => {
        calls++;
        return false;
      });
      try {
        await waitForReady(conn, { timeoutMs: 40, intervalMs: 10 });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
        expect((e as Error).message).toContain('mock-host');
        expect((e as Error).message).toContain('40ms');
      }
      expect(calls).toBeGreaterThan(1);
      void mockCtx;
    });
  });

  test('propagates abort', async () => {
    await withMockContext(async () => {
      const conn = new MockConnector('mock-host', 'mock', void 0);
      conn.isReady = mock(async () => false);
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(new AbortError('stop')), 20);
      try {
        await waitForReady(conn, { timeoutMs: 5000, intervalMs: 10, signal: ctrl.signal });
        expect.unreachable();
      } catch (e) {
        expect(isAbortError(e)).toBe(true);
      }
    });
  });

  test('refuses invalid conn inside the task context', async () => {
    await withMockContext(async (mockCtx) => {
      try {
        await waitForReady(void 0 as unknown as MockConnector, { timeoutMs: 50, intervalMs: 10 });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('refusing: conn with isReady() is required');
      }
      const taskErr = mockCtx.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
    });
  });

  test('refuses bad timeoutMs inside the task context', async () => {
    await withMockContext(async (mockCtx) => {
      const conn = new MockConnector('mock-host', 'mock', void 0);
      try {
        await waitForReady(conn, { timeoutMs: 0, intervalMs: 10 });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("refusing: bad timeoutMs '0'");
      }
      const taskErr = mockCtx.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
    });
  });
});

describe('connector isReady', () => {
  test('LocalConnector is always ready', async () => {
    const conn = new LocalConnector();
    expect(await conn.isReady()).toBe(true);
  });

  test('PodmanConnector reports running state only', async () => {
    await installFakePodman('#!/bin/sh\necho "running"\n');
    expect(await new PodmanConnector({ host: 'c1' }).isReady()).toBe(true);
  });

  test('PodmanConnector returns false when stopped', async () => {
    await installFakePodman('#!/bin/sh\necho "exited"\n');
    expect(await new PodmanConnector({ host: 'c1' }).isReady()).toBe(false);
  });

  test('PodmanConnector returns false on inspect error, no throw', async () => {
    await installFakePodman('#!/bin/sh\necho "no such container" >&2\nexit 125\n');
    expect(await new PodmanConnector({ host: 'missing' }).isReady()).toBe(false);
  });

  test('SSHConnector isReady false then true, no tmpdir allocation', async () => {
    const countFile = join(await makeTempDir('sysopkit-count-'), 'count');
    await fs.writeFile(countFile, '0');
    const { env } = await installFakeSsh(
      '#!/bin/sh\nc=$(cat "$COUNT_FILE"); c=$((c+1)); echo "$c" > "$COUNT_FILE"\nif [ "$c" -ge 2 ]; then exit 0; else exit 255; fi\n',
      { COUNT_FILE: countFile },
    );
    const before = await sysopkitTmpEntries();
    const conn = new SSHConnector({
      host: 'localhost',
      user: 'testuser',
      strictHostKeyChecking: false,
      controlMaster: false,
      timeout: 2,
    });
    conn.env = env;
    try {
      expect(await conn.isReady()).toBe(false);
      expect(await conn.isReady()).toBe(true);
      expect(await sysopkitTmpEntries()).toEqual(before);
    } finally {
      await conn[Symbol.asyncDispose]();
    }
  });

  test('SSHConnector isReady throws only on misuse', async () => {
    const conn = new SSHConnector({ host: '', user: 'testuser', controlMaster: false });
    try {
      await conn.isReady();
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('refusing');
    } finally {
      await conn[Symbol.asyncDispose]();
    }
  });

  test('SSHConnector connect failure cleans tmpdir so retry does not leak', async () => {
    const countFile = join(await makeTempDir('sysopkit-count-'), 'count');
    await fs.writeFile(countFile, '0');
    const { env } = await installFakeSsh(
      '#!/bin/sh\nc=$(cat "$COUNT_FILE"); c=$((c+1)); echo "$c" > "$COUNT_FILE"\nfor arg in "$@"; do\n  if [ "$arg" = "LogLevel=VERBOSE" ]; then\n    echo "debug1: Offering public key: fake-key" >&2\n    exit 255\n  fi\ndone\nif [ "$c" -ge 3 ]; then exit 0; else exit 255; fi\n',
      { COUNT_FILE: countFile },
    );
    const baseline = await sysopkitTmpEntries();
    const conn = new SSHConnector({
      host: 'localhost',
      user: 'testuser',
      strictHostKeyChecking: false,
      timeout: 2,
    });
    conn.env = env;
    try {
      try {
        await conn.connect();
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("connect failed with exit code '255'");
      }
      // Retry must succeed (sticky error cleared) without leaking the first tmpdir.
      await conn.connect();
      await conn.connect();
    } finally {
      await conn[Symbol.asyncDispose]();
    }
    expect(await sysopkitTmpEntries()).toEqual(baseline);
  });
});
