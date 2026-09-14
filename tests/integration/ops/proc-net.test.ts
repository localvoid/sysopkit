import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { bash, waitPort as waitPortBash } from 'sysopkit/op/bash';
import { curl } from 'sysopkit/op/curl';
import { exec } from 'sysopkit/op/exec';
import { readFile, writeFile } from 'sysopkit/op/file';
import { waitPort as waitPortNc } from 'sysopkit/op/netcat';
import { waitProcess } from 'sysopkit/op/proc';
import { $_, sh } from 'sysopkit/op/sh';

import { remoteTempPath, sharedPodman, startSharedContainer, type Container } from '../container.js';

/** Starts a TCP server via bun (parity images have no python3). Returns pid file. */
async function startTcpServer(port: number, body = 'ok'): Promise<string> {
  const pidFile = remoteTempPath('srv-pid-');
  const script = `Bun.serve({port:${port},fetch:()=>new Response(${JSON.stringify(body)})})`;
  await sh(`bun -e ${$_(script)} >/dev/null 2>&1 & echo $! > ${$_(pidFile)}`);
  return pidFile;
}

/** Stops a server started with startTcpServer (kill by PID, never pkill -f). */
async function stopTcpServer(pidFile: string): Promise<void> {
  await sh(`kill $(cat ${$_(pidFile)}) 2>/dev/null || true`);
}

describe('proc/net ops', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'fedora', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('waitProcess resolves for running process', async () => {
    await sharedPodman(shared, async () => {
      await waitProcess({ process: 'sh' });
    });
  });

  test('waitProcess resolves when process appears and terminates', async () => {
    await sharedPodman(shared, async () => {
      const pidFile = remoteTempPath('sleep-pid-');
      await sh(`sleep 60 & echo $! > ${$_(pidFile)}`);
      await waitProcess({ process: 'sleep', delay: 50 });
      await sh(`kill $(cat ${$_(pidFile)})`);
      await waitProcess({ process: 'sleep', state: 'terminated', delay: 50 });
    });
  });

  test('bash waitPort detects open and closed ports', async () => {
    await sharedPodman(shared, async () => {
      const port = 18710;
      const pidFile = await startTcpServer(port);
      try {
        await waitPortBash({ port, delay: 50 });
        const { exitCode } = await bash(`echo >/dev/tcp/localhost/${port}||exit 64`);
        expect(exitCode).toBe(0);
      } finally {
        await stopTcpServer(pidFile);
      }
      await waitPortBash({ port, state: 'close', delay: 50 });
    });
  });

  test('netcat waitPort detects open port', async () => {
    await sharedPodman(shared, async () => {
      const port = 18711;
      const pidFile = await startTcpServer(port);
      try {
        await waitPortNc({ port, delay: 50 });
      } finally {
        await stopTcpServer(pidFile);
      }
    });
  });

  test('curl downloads file:// URL to path', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('curl-src-');
      const dst = remoteTempPath('curl-dst-');
      await writeFile(src, 'curl-content\n');
      await curl({ url: `file://${src}`, path: dst });
      expect(await readFile(dst)).toBe('curl-content\n');
    });
  });

  test('curl downloads over http and verifies content', async () => {
    await sharedPodman(shared, async () => {
      const dst = remoteTempPath('curl-http-dst-');
      const port = 18712;
      const pidFile = await startTcpServer(port, 'hello-http\n');
      try {
        await waitPortBash({ port, delay: 50 });
        await curl({ url: `http://localhost:${port}/index.html`, path: dst });
        expect(await readFile(dst)).toBe('hello-http\n');
      } finally {
        await stopTcpServer(pidFile);
      }
    });
  });

  test('sh reports real stdout/stderr/exit codes', async () => {
    await sharedPodman(shared, async () => {
      const out = await sh(`echo hello`);
      expect(out.stdout.trim()).toBe('hello');
      expect(out.exitCode).toBe(0);
      const err = await exec(['sh', '-c', 'echo oops >&2; exit 64']);
      expect(err.stderr.trim()).toBe('oops');
      expect(err.exitCode).toBe(64);
    });
  });
});
