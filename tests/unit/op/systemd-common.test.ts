import { describe, expect, test } from 'bun:test';
import {
  getSystemdConfigDropInPath,
  getSystemdConfigPath,
  getUnitPath,
  parseKeyValue,
} from '@sysopkit/linux/systemd';

describe('getUnitPath', () => {
  test('returns system path by default', () => {
    expect(getUnitPath('nginx.service')).toBe('/etc/systemd/system/nginx.service');
  });

  test('returns user path relative to home without user', () => {
    expect(getUnitPath('app.service', { scope: 'user' })).toBe('.config/systemd/user/app.service');
  });

  test('returns absolute user path with user', () => {
    expect(getUnitPath('app.service', { scope: 'user', user: 'alice' })).toBe(
      '/home/alice/.config/systemd/user/app.service',
    );
  });
});

describe('getSystemdConfigPath', () => {
  test('returns system config path by default', () => {
    expect(getSystemdConfigPath('journald.conf')).toBe('/etc/systemd/journald.conf');
  });

  test('returns user config path with user', () => {
    expect(getSystemdConfigPath('journald.conf', { user: 'alice' })).toBe(
      '/home/alice/.config/systemd/journald.conf',
    );
  });
});

describe('getSystemdConfigDropInPath', () => {
  test('returns drop-in path', () => {
    expect(getSystemdConfigDropInPath('journald.conf', 'sysops')).toBe(
      '/etc/systemd/journald.conf.d/sysops.conf',
    );
  });
});

describe('parseKeyValue', () => {
  test('parses systemctl show output', () => {
    expect(parseKeyValue('Id=nginx.service\nActiveState=active\n')).toEqual({
      Id: 'nginx.service',
      ActiveState: 'active',
    });
  });

  test('keeps equals signs inside values', () => {
    expect(parseKeyValue('ExecStart=/bin/sh -c "a=b"\n')).toEqual({
      ExecStart: '/bin/sh -c "a=b"',
    });
  });

  test('skips lines without equals sign', () => {
    expect(parseKeyValue('garbage\nId=x.service\n')).toEqual({ Id: 'x.service' });
  });
});
