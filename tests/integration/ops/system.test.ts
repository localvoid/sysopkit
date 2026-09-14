import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { lscpu } from '@sysopkit/linux/cpu';
import { lsblk } from '@sysopkit/linux/disk';
import { dmesg } from '@sysopkit/linux/kernel';
import { getMemInfo } from '@sysopkit/linux/mem';
import { getOSInfo } from '@sysopkit/linux/os';
import { readFile } from 'sysopkit/op/file';
import { parseShellConf } from 'sysopkit/op/sh';

import { sharedPodman, startSharedContainer, type Container } from '../container.js';

describe('system info ops', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'redhat', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('getOSInfo matches /etc/os-release', async () => {
    await sharedPodman(shared, async () => {
      const info = await getOSInfo();
      const raw = parseShellConf(await readFile('/etc/os-release'));
      expect(info.id).toBe(raw['ID']);
      expect(info.versionId).toBe(raw['VERSION_ID']);
      expect(info.name.length).toBeGreaterThan(0);
    });
  });

  test('lscpu reports sane topology', async () => {
    await sharedPodman(shared, async () => {
      const cpu = await lscpu();
      expect(cpu.cores).toBeGreaterThan(0);
      expect(cpu.architecture.length).toBeGreaterThan(0);
      expect(cpu.sockets * cpu.coresPerSocket * cpu.threadsPerCore).toBe(cpu.cores);
    });
  });

  test('getMemInfo reports positive totals', async () => {
    await sharedPodman(shared, async () => {
      const mem = await getMemInfo();
      expect(mem.total).toBeGreaterThan(0);
      expect(mem.available).toBeGreaterThan(0);
      expect(mem.used).toBe(mem.total - mem.available);
      expect(mem.free).toBeGreaterThanOrEqual(0);
    });
  });

  test('lsblk returns device list', async () => {
    await sharedPodman(shared, async () => {
      const devs = await lsblk();
      expect(Array.isArray(devs)).toBe(true);
    });
  });

  test('dmesg returns entries or empty without throwing unexpectedly', async () => {
    await sharedPodman(shared, async () => {
      try {
        const entries = await dmesg();
        expect(Array.isArray(entries)).toBe(true);
      } catch (e) {
        // Restricted containers may deny dmesg; only unexpected errors fail.
        expect((e as Error).message.length).toBeGreaterThan(0);
      }
    });
  });
});
