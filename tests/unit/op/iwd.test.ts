import { describe, expect, test } from 'bun:test';
import { encodeIwdSsid, getIwdNetworkPath } from '@sysopkit/linux/iwd';

describe('encodeIwdSsid', () => {
  test('leaves alphanumeric/space/underscore/minus names verbatim', () => {
    expect(encodeIwdSsid('Coffee Shop')).toBe('Coffee Shop');
    expect(encodeIwdSsid('my-net_1')).toBe('my-net_1');
  });

  test('hex-encodes names with other characters', () => {
    expect(encodeIwdSsid('a/b')).toBe('=612f62');
  });

  test('hex-encodes non-ASCII as UTF-8 bytes', () => {
    expect(encodeIwdSsid('Café')).toBe('=436166c3a9');
  });
});

describe('getIwdNetworkPath', () => {
  test('builds verbatim and encoded paths with security suffix', () => {
    expect(getIwdNetworkPath('Coffee Shop', 'psk')).toBe('/var/lib/iwd/Coffee Shop.psk');
    expect(getIwdNetworkPath('a/b', '8021x')).toBe('/var/lib/iwd/=612f62.8021x');
    expect(getIwdNetworkPath('home', 'open')).toBe('/var/lib/iwd/home.open');
  });
});
