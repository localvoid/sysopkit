import { describe, expect, test } from 'bun:test';
import { mockSpawn, withMockContext } from '@sysopkit/test-utils';
import { mountInfo, parseFstab, serializeFstab, type FstabEntry } from 'sysopkit/op/mount';

// Unit scope: findmnt JSON parsing and fstab serialization only.
// Real mount/umount behavior (idempotency, dry-run, round-trip) is covered
// in tests/e2e/ops/mount.test.ts with actual tmpfs mounts.

const FINDMNT_JSON = JSON.stringify({
  filesystems: [
    {
      target: '/mnt/data',
      source: '/dev/sda1',
      fstype: 'ext4',
      options: 'rw,relatime',
    },
  ],
});

function mockFindmnt(path: string, stdout: string, exitCode = 0) {
  return {
    cmd: ['sh', '-c', `findmnt --json --target ${path};o=$?;if [ $o -eq 1 ];then exit 64;else exit $o;fi`],
    stdout,
    exitCode: exitCode === 1 ? 64 : exitCode,
  };
}

describe('mountInfo', () => {
  test('returns mount info for mounted path', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [mockFindmnt('/mnt/data', FINDMNT_JSON)]);

      const result = await mountInfo({ path: '/mnt/data' });

      expect(result).toEqual({
        target: '/mnt/data',
        source: '/dev/sda1',
        fstype: 'ext4',
        options: 'rw,relatime',
      });
    });
  });

  test('returns null for unmounted path', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [mockFindmnt('/mnt/nonexistent', '', 64)]);

      const result = await mountInfo({ path: '/mnt/nonexistent' });

      expect(result).toBeNull();
    });
  });

  test('returns null for invalid JSON', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [mockFindmnt('/mnt/data', 'invalid json')]);

      const result = await mountInfo({ path: '/mnt/data' });

      expect(result).toBeNull();
    });
  });

  test('returns null when findmnt reports the parent filesystem', async () => {
    await withMockContext(async ({ conn }) => {
      const parentJson = JSON.stringify({
        filesystems: [{ target: '/', source: 'overlay', fstype: 'overlay', options: 'rw' }],
      });
      mockSpawn(conn, [mockFindmnt('/mnt/data', parentJson)]);

      const result = await mountInfo({ path: '/mnt/data' });

      expect(result).toBeNull();
    });
  });
});

describe('fstab', () => {
  const entries: FstabEntry[] = [
    { device: '/dev/sda1', mountPoint: '/', fsType: 'ext4', options: ['defaults'], dump: 0, pass: 1 },
    {
      device: 'UUID=abc-123',
      mountPoint: '/mnt/data',
      fsType: 'ext4',
      options: ['defaults', 'noatime'],
      dump: 0,
      pass: 2,
    },
  ];

  test('serialize/parse round-trip', () => {
    expect(parseFstab(serializeFstab(entries))).toEqual(entries);
  });

  test('parse skips comments and blank lines', () => {
    const parsed = parseFstab('# comment\n\n/dev/sda1 / ext4 defaults 0 1\n');
    expect(parsed.length).toBe(1);
    expect(parsed[0].mountPoint).toBe('/');
  });

  test('escapes spaces in fields', () => {
    const withSpace: FstabEntry[] = [
      { device: '/dev/disk', mountPoint: '/mnt/my data', fsType: 'ext4', options: ['defaults'], dump: 0, pass: 0 },
    ];
    expect(parseFstab(serializeFstab(withSpace))).toEqual(withSpace);
  });
});
