import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { serializeUci } from '@sysopkit/openwrt/uci';
import { exec } from 'sysopkit/op/exec';
import { getPathInfo, readFile, writeFile } from 'sysopkit/op/file';
import { sh } from 'sysopkit/op/sh';

import {
  remoteTempPath,
  sharedPodman,
  startSharedContainer,
  type Container,
} from '../container.js';

/** OpenWrt is non-parity: only `sh` + busybox applets, no sudo user. */
describe('openwrt ops', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'openwrt', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('sh runs via busybox', async () => {
    await sharedPodman(shared, async () => {
      const { stdout, exitCode } = await exec(['sh', '-c', 'echo hello']);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('hello');
    });
  });

  test('file write/read round-trip with busybox sh', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('owrt-file-');
      await writeFile(p, 'openwrt-data\n');
      expect(await readFile(p)).toBe('openwrt-data\n');
      expect((await getPathInfo(p))?.type).toBe('file');
    });
  });

  test('uci serialize → write → read round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('owrt-uci-');
      const content = serializeUci([
        { type: 'interface', name: 'lan', options: { proto: 'static', ipaddr: '192.168.1.1' } },
      ]);
      await writeFile(p, content);
      const back = await readFile(p);
      expect(back).toContain('config interface');
      expect(back).toContain("option ipaddr '192.168.1.1'");
    });
  });

  test('os-release identifies openwrt', async () => {
    await sharedPodman(shared, async () => {
      const { stdout } = await sh('cat /etc/os-release');
      expect(stdout).toContain('openwrt');
    });
  });
});
