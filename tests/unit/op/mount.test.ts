import { describe, expect, test } from 'bun:test';
import {
  _propagationSatisfied,
  filterRelevantSubmounts,
  parseFindmntInfo,
  parseFstab,
  parseSubmountTargets,
  serializeFstab,
  type FstabEntry,
} from 'sysopkit/op/mount';

// Unit scope: findmnt JSON parsing and fstab serialization only (pure,
// no connector). Real mount/umount behavior (idempotency, dry-run,
// round-trip) is covered in tests/e2e/ops/mount.test.ts with actual
// tmpfs mounts.

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

describe('parseFindmntInfo', () => {
  test('returns mount info for mounted path', () => {
    expect(parseFindmntInfo(FINDMNT_JSON, '/mnt/data')).toEqual({
      target: '/mnt/data',
      source: '/dev/sda1',
      fstype: 'ext4',
      options: 'rw,relatime',
    });
  });

  test('returns null for invalid JSON', () => {
    expect(parseFindmntInfo('invalid json', '/mnt/data')).toBeNull();
  });

  test('returns null when findmnt reports the parent filesystem', () => {
    const parentJson = JSON.stringify({
      filesystems: [{ target: '/', source: 'overlay', fstype: 'overlay', options: 'rw' }],
    });
    expect(parseFindmntInfo(parentJson, '/mnt/data')).toBeNull();
  });

  test('returns propagation when findmnt reports it', () => {
    const json = JSON.stringify({
      filesystems: [
        {
          target: '/mnt/data',
          source: '/dev/sda1',
          fstype: 'ext4',
          options: 'rw,relatime',
          propagation: 'private,slave',
        },
      ],
    });
    expect(parseFindmntInfo(json, '/mnt/data')?.propagation).toBe('private,slave');
  });

  test('returns null for empty filesystems', () => {
    expect(parseFindmntInfo(JSON.stringify({ filesystems: [] }), '/mnt/data')).toBeNull();
  });
});

describe('parseSubmountTargets', () => {
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

  test('walks nested children', () => {
    expect(parseSubmountTargets(TREE_JSON)).toEqual(['/mnt/data', '/mnt/data/sub']);
  });

  test('returns null for invalid JSON', () => {
    expect(parseSubmountTargets('invalid json')).toBeNull();
  });

  test('collects orphaned children under root', () => {
    const orphanJson = JSON.stringify({
      filesystems: [
        {
          target: '/',
          source: 'overlay',
          fstype: 'overlay',
          options: 'rw',
          children: [{ target: '/mnt/data/sub', source: 'tmpfs', fstype: 'tmpfs', options: 'rw' }],
        },
      ],
    });
    expect(parseSubmountTargets(orphanJson)).toEqual(['/', '/mnt/data/sub']);
  });
});

describe('filterRelevantSubmounts', () => {
  test('keeps targets at or under path, deepest first', () => {
    const targets = ['/', '/mnt/data', '/mnt/data/a', '/mnt/data/a/b', '/other'];
    expect(filterRelevantSubmounts(targets, '/mnt/data')).toEqual([
      '/mnt/data/a/b',
      '/mnt/data/a',
      '/mnt/data',
    ]);
  });

  test('returns empty when nothing is mounted at or under path', () => {
    expect(filterRelevantSubmounts(['/', '/other'], '/mnt/data')).toEqual([]);
  });
});

describe('_propagationSatisfied', () => {
  test('recursive and non-recursive spellings match', () => {
    expect(_propagationSatisfied('rslave', 'private,slave')).toBe(true);
    expect(_propagationSatisfied('slave', 'slave')).toBe(true);
    expect(_propagationSatisfied('rshared', 'shared')).toBe(true);
  });

  test('mismatched propagation does not satisfy', () => {
    expect(_propagationSatisfied('rshared', 'private')).toBe(false);
  });

  test('unknown (absent column) never matches', () => {
    expect(_propagationSatisfied('rslave', undefined)).toBe(false);
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
