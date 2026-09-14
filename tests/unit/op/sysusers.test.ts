import { describe, expect, test } from 'bun:test';
import { parseSysusersConf, serializeSysusersConf } from '@sysopkit/linux/systemd';

describe('parseSysusersConf', () => {
  test('parses user, group, member, and range entries', () => {
    const result = parseSysusersConf(
      'u appuser - "App User" /var/lib/app\n' + 'g appgroup 410\n' + 'm appuser appgroup\n' + 'r - 500-900\n',
    );

    expect(result).toEqual([
      { type: 'u', name: 'appuser', gecos: 'App User', home: '/var/lib/app' },
      { type: 'g', name: 'appgroup', id: '410' },
      { type: 'm', name: 'appuser', id: 'appgroup' },
      { type: 'r', name: '-', id: '500-900' },
    ]);
  });

  test('skips comments, blank lines, and unknown types', () => {
    const result = parseSysusersConf('# comment\n\nu appuser\nx bogus entry\n');

    expect(result).toEqual([{ type: 'u', name: 'appuser' }]);
  });

  test('parses locked user type', () => {
    const result = parseSysusersConf('u! httpd 404 "HTTP User"\n');

    expect(result).toEqual([{ type: 'u!', name: 'httpd', id: '404', gecos: 'HTTP User' }]);
  });

  test('treats dash fields as absent', () => {
    const result = parseSysusersConf('u appuser - - -\n');

    expect(result).toEqual([{ type: 'u', name: 'appuser' }]);
  });
});

describe('serializeSysusersConf', () => {
  test('serializes user with quoted gecos and trailing newline', () => {
    const result = serializeSysusersConf([
      { type: 'u', name: 'appuser', gecos: 'App User', home: '/var/lib/app' },
    ]);

    expect(result).toBe('u appuser - "App User" /var/lib/app\n');
  });

  test('serializes group, member, and range entries', () => {
    const result = serializeSysusersConf([
      { type: 'g', name: 'appgroup', id: '410' },
      { type: 'm', name: 'appuser', id: 'appgroup' },
      { type: 'r', name: '-', id: '500-900' },
    ]);

    expect(result).toBe('g appgroup 410\nm appuser appgroup\nr - 500-900\n');
  });

  test('round-trips through parse', () => {
    const conf = [
      { type: 'u' as const, name: 'appuser', gecos: 'App User', home: '/var/lib/app' },
      { type: 'u!' as const, name: 'httpd', id: '404', gecos: 'HTTP User' },
      { type: 'g' as const, name: 'appgroup', id: '410' },
    ];

    expect(parseSysusersConf(serializeSysusersConf(conf))).toEqual(conf);
  });
});
