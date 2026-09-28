import { describe, expect, test } from 'bun:test';
import { getSpawnCalls, mockSpawn, withMockContext } from '@sysopkit/test-utils';
import {
  mount,
  mountInfo,
  parseFstab,
  serializeFstab,
  umount,
  type FstabEntry,
} from 'sysopkit/op/mount';

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
    cmd: [
      'sh',
      '-c',
      `findmnt --json --target ${path};o=$?;if [ $o -eq 1 ];then exit 64;else exit $o;fi`,
    ],
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

describe('mount command construction', () => {
  test('regular mount emits mount -t -o', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockFindmnt('/mnt/data', '', 64),
        { cmd: ['sh', '-c', 'mount -t tmpfs -o defaults tmpfs /mnt/data'] },
      ]);

      await mount({ src: 'tmpfs', path: '/mnt/data', fstype: 'tmpfs' });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('bind emits mount --bind without -t/-o', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockFindmnt('/mnt/data', '', 64),
        { cmd: ['sh', '-c', 'mount --bind /srv/data /mnt/data'] },
      ]);

      await mount({ src: '/srv/data', path: '/mnt/data', bind: true });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('rslave implies bind and emits --make-rslave --bind', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockFindmnt('/mnt/dev', '', 64),
        { cmd: ['sh', '-c', 'mount --make-rslave --bind /dev /mnt/dev'] },
      ]);

      await mount({ src: '/dev', path: '/mnt/dev', rslave: true });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('bind skips when path already exposes src inode', async () => {
    await withMockContext(async ({ conn }) => {
      const bindJson = JSON.stringify({
        filesystems: [{ target: '/mnt/data', source: 'overlay', fstype: 'overlay', options: 'rw' }],
      });
      mockSpawn(conn, [
        mockFindmnt('/mnt/data', bindJson),
        {
          cmd: ['sh', '-c', `stat -c '%d %i' /srv/data; stat -c '%d %i' /mnt/data`],
          stdout: '8 123\n8 123\n',
        },
      ]);

      await mount({ src: '/srv/data', path: '/mnt/data', bind: true });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('bind mounts over drifted target with different inode', async () => {
    await withMockContext(async ({ conn }) => {
      const bindJson = JSON.stringify({
        filesystems: [{ target: '/mnt/data', source: 'overlay', fstype: 'overlay', options: 'rw' }],
      });
      mockSpawn(conn, [
        mockFindmnt('/mnt/data', bindJson),
        {
          cmd: ['sh', '-c', `stat -c '%d %i' /srv/data; stat -c '%d %i' /mnt/data`],
          stdout: '8 123\n8 456\n',
        },
        { cmd: ['sh', '-c', 'mount --bind /srv/data /mnt/data'] },
      ]);

      await mount({ src: '/srv/data', path: '/mnt/data', bind: true });

      expect(getSpawnCalls(conn)).toHaveLength(3);
    });
  });

  test('refuses regular mount without fstype', async () => {
    await withMockContext(async () => {
      try {
        await mount({ src: 'tmpfs', path: '/mnt/data' });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('fstype is required');
      }
    });
  });
});

function mockSubmounts(path: string, stdout: string, exitCode = 0) {
  return {
    cmd: [
      'sh',
      '-c',
      `findmnt -R --json --target ${path};o=$?;if [ $o -eq 1 ];then exit 64;else exit $o;fi`,
    ],
    stdout,
    exitCode: exitCode === 1 ? 64 : exitCode,
  };
}

describe('umount options', () => {
  const TREE_JSON = JSON.stringify({
    filesystems: [
      {
        target: '/mnt/data',
        source: 'tmpfs',
        fstype: 'tmpfs',
        options: 'rw',
        children: [{ target: '/mnt/data/sub', source: 'tmpfs', fstype: 'tmpfs', options: 'rw' }],
      },
    ],
  });

  test('recursive+lazy+ignoreErrors emits umount -l -R with || true', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockSubmounts('/mnt/data', TREE_JSON),
        { cmd: ['sh', '-c', 'umount -l -R /mnt/data 2>/dev/null || true'] },
      ]);

      await umount({ path: '/mnt/data', recursive: true, lazy: true, ignoreErrors: true });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('recursive without ignoreErrors emits strict umount -R', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        mockSubmounts('/mnt/data', TREE_JSON),
        { cmd: ['sh', '-c', 'umount -R /mnt/data'] },
      ]);

      await umount({ path: '/mnt/data', recursive: true });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('recursive detaches on orphaned child when root is unmounted', async () => {
    await withMockContext(async ({ conn }) => {
      const orphanJson = JSON.stringify({
        filesystems: [
          {
            target: '/',
            source: 'overlay',
            fstype: 'overlay',
            options: 'rw',
            children: [
              { target: '/mnt/data/sub', source: 'tmpfs', fstype: 'tmpfs', options: 'rw' },
            ],
          },
        ],
      });
      mockSpawn(conn, [
        mockSubmounts('/mnt/data', orphanJson),
        // `umount -R /mnt/data` requires the path itself to be mounted
        // (live: "not mounted" while the child stays attached), so orphans
        // are detached directly.
        { cmd: ['sh', '-c', 'umount /mnt/data/sub'] },
      ]);

      await umount({ path: '/mnt/data', recursive: true });

      expect(getSpawnCalls(conn)).toHaveLength(2);
    });
  });

  test('recursive detaches multiple orphans deepest first with lazy', async () => {
    await withMockContext(async ({ conn }) => {
      const orphanJson = JSON.stringify({
        filesystems: [
          {
            target: '/',
            source: 'overlay',
            fstype: 'overlay',
            options: 'rw',
            children: [
              { target: '/mnt/data/a', source: 'tmpfs', fstype: 'tmpfs', options: 'rw' },
              { target: '/mnt/data/a/b', source: 'tmpfs', fstype: 'tmpfs', options: 'rw' },
            ],
          },
        ],
      });
      mockSpawn(conn, [
        mockSubmounts('/mnt/data', orphanJson),
        { cmd: ['sh', '-c', 'umount -l /mnt/data/a/b'] },
        { cmd: ['sh', '-c', 'umount -l /mnt/data/a'] },
      ]);

      await umount({ path: '/mnt/data', recursive: true, lazy: true });

      expect(getSpawnCalls(conn)).toHaveLength(3);
    });
  });

  test('recursive skips when nothing is mounted at or under path', async () => {
    await withMockContext(async ({ conn }) => {
      const bareJson = JSON.stringify({
        filesystems: [{ target: '/', source: 'overlay', fstype: 'overlay', options: 'rw' }],
      });
      mockSpawn(conn, [mockSubmounts('/mnt/data', bareJson)]);

      await umount({ path: '/mnt/data', recursive: true });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('recursive skips when path resolves to no filesystem', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [mockSubmounts('/mnt/missing', '', 64)]);

      await umount({ path: '/mnt/missing', recursive: true });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('plain umount still skips unmounted path', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [mockFindmnt('/mnt/data', '', 64)]);

      await umount({ path: '/mnt/data' });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });
});

describe('fstab', () => {
  const entries: FstabEntry[] = [
    {
      device: '/dev/sda1',
      mountPoint: '/',
      fsType: 'ext4',
      options: ['defaults'],
      dump: 0,
      pass: 1,
    },
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
      {
        device: '/dev/disk',
        mountPoint: '/mnt/my data',
        fsType: 'ext4',
        options: ['defaults'],
        dump: 0,
        pass: 0,
      },
    ];
    expect(parseFstab(serializeFstab(withSpace))).toEqual(withSpace);
  });
});
