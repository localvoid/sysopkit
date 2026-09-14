import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { parseLimitsConf, serializeLimitsConf } from '@sysopkit/linux/limits';
import { serializeSudoersConf } from '@sysopkit/linux/sudoers';
import { parseSysctlConf, serializeSysctlConf } from '@sysopkit/linux/sysctl';
import { parseSysusersConf, serializeSysusersConf } from '@sysopkit/linux/systemd';
import { parseTmpFilesConf, serializeTmpFilesConf } from '@sysopkit/linux/systemd';
import { readFile, writeFile } from 'sysopkit/op/file';
import { serializeIni } from 'sysopkit/op/ini';
import { parseHosts, serializeHosts } from 'sysopkit/op/net';
import { sh } from 'sysopkit/op/sh';
import { serializeSshConf } from 'sysopkit/op/ssh';

import {
  remoteTempPath,
  sharedPodman,
  startSharedContainer,
  type Container,
} from '../container.js';

describe('config file ops', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'redhat', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('hosts serialize → write → read → parse round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-hosts-');
      const entries = [
        { ip: '127.0.0.1', hostnames: ['localhost'] },
        { ip: '10.0.0.5', hostnames: ['web', 'web.local'] },
      ];
      await writeFile(p, serializeHosts(entries));
      const back = parseHosts(await readFile(p));
      expect(back).toEqual(entries);
    });
  });

  test('real /etc/hosts parses and contains localhost', async () => {
    await sharedPodman(shared, async () => {
      const entries = parseHosts(await readFile('/etc/hosts'));
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some((e) => e.hostnames.includes('localhost'))).toBe(true);
    });
  });

  test('ini serialize → write → read round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-ini-');
      const data = { Network: { Address: ['10.0.0.1', '10.0.0.2'], DHCP: 'yes' } };
      await writeFile(p, serializeIni(data));
      const content = await readFile(p);
      expect(content).toContain('[Network]');
      expect(content).toContain('Address=10.0.0.1');
      expect(content).toContain('Address=10.0.0.2');
    });
  });

  test('sysctl serialize → write → read → parse round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-sysctl-');
      const conf = { 'net.ipv4.ip_forward': '1', 'net.core.somaxconn': '65535' };
      await writeFile(p, serializeSysctlConf(conf));
      expect(parseSysctlConf(await readFile(p))).toEqual(conf);
    });
  });

  test('real sysctl value matches /proc/sys', async () => {
    await sharedPodman(shared, async () => {
      const { stdout } = await sh('cat /proc/sys/net/ipv4/ip_forward');
      expect(stdout.trim()).toMatch(/^[01]$/);
    });
  });

  test('limits serialize → write → read → parse round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-limits-');
      const entries = [
        { domain: '*', limitType: 'soft' as const, item: 'nofile', value: '65535' },
        { domain: '@web', limitType: 'hard' as const, item: 'nproc', value: '200' },
      ];
      await writeFile(p, serializeLimitsConf(entries));
      expect(parseLimitsConf(await readFile(p))).toEqual(entries);
    });
  });

  test('tmpfiles serialize → write → read → parse round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-tmpfiles-');
      // Note: '-' is tmpfiles syntax for "absent" and parses back as
      // undefined, so only populated fields round-trip exactly.
      const conf = [
        {
          type: 'd' as const,
          path: '/run/app',
          mode: '0755',
          user: 'root',
          group: 'root',
          age: '30d',
        },
      ];
      await writeFile(p, serializeTmpFilesConf(conf));
      expect(parseTmpFilesConf(await readFile(p))).toEqual(conf);
    });
  });

  test('sudoers serialize → write → visudo validates', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-sudoers-');
      const content = serializeSudoersConf([
        {
          user: 'testuser',
          hosts: ['ALL'],
          runas: 'ALL',
          commands: ['/usr/bin/systemctl'],
          nopasswd: true,
        },
      ]);
      await writeFile(p, content);
      expect(await readFile(p)).toContain('NOPASSWD:');
      const { exitCode } = await sh(`visudo -c -f ${p}`);
      expect(exitCode).toBe(0);
    });
  });

  test('sysusers serialize → write → read → parse round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-sysusers-');
      // Note: '-' is sysusers syntax for "automatic/absent" and parses back
      // as undefined, so only populated fields round-trip exactly.
      const conf = [
        { type: 'u' as const, name: 'appuser', gecos: 'App User', home: '/var/lib/app' },
        { type: 'g' as const, name: 'appgroup', id: '410' },
        { type: 'm' as const, name: 'appuser', id: 'appgroup' },
      ];
      await writeFile(p, serializeSysusersConf(conf));
      expect(parseSysusersConf(await readFile(p))).toEqual(conf);
    });
  });

  test('sshd serialize → write → read round-trip', async () => {
    await sharedPodman(shared, async () => {
      const p = remoteTempPath('cfg-sshd-');
      const content = serializeSshConf({
        port: 2222,
        options: { PasswordAuthentication: false, X11Forwarding: false },
      });
      await writeFile(p, content);
      const back = await readFile(p);
      expect(back).toContain('Port 2222');
      expect(back).toContain('PasswordAuthentication no');
    });
  });
});
