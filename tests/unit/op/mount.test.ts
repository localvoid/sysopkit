import { describe, expect, test } from 'bun:test';
import { getSpawnCalls, mockSpawn, trackChanged, withMockContext } from '@sysopkit/test-utils';
import { mount, mountInfo, umount } from 'sysopkit/op/mount';

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
    cmd: ['sh', '-c', `findmnt --json --target ${path};[ $? -eq 1 ]&&exit 64||exit $?`],
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
});

describe('mount', () => {
  test('mounts when not mounted', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [
        mockFindmnt('/mnt/data', '', 64),
        { cmd: ['sh', '-c', 'mount -t ext4 -o defaults /dev/sda1 /mnt/data'], exitCode: 0 },
      ]);

      await mount({
        src: '/dev/sda1',
        path: '/mnt/data',
        fstype: 'ext4',
      });

      expect(tracker.changed).toBe(true);
      const calls = getSpawnCalls(conn);
      expect(calls.length).toBe(2);
    });
  });

  test('is idempotent when already mounted with same options', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [mockFindmnt('/mnt/data', FINDMNT_JSON)]);

      await mount({
        src: '/dev/sda1',
        path: '/mnt/data',
        fstype: 'ext4',
      });

      expect(tracker.changed).toBe(false);
      const calls = getSpawnCalls(conn);
      expect(calls.length).toBe(1);
    });
  });

  test('unmounts when mounted and state is unmounted', async () => {
    await withMockContext(async ({ conn }) => {
      const tracker = trackChanged();
      mockSpawn(conn, [
        mockFindmnt('/mnt/data', FINDMNT_JSON),
        { cmd: ['sh', '-c', 'umount /mnt/data'], exitCode: 0 },
      ]);

      await umount({
        path: '/mnt/data',
      });

      expect(tracker.changed).toBe(true);
      const calls = getSpawnCalls(conn);
      expect(calls.length).toBe(2);
    });
  });

  test('reports change in dryRun', async () => {
    await withMockContext(
      async ({ conn }) => {
        const tracker = trackChanged();
        mockSpawn(conn, [mockFindmnt('/mnt/data', '', 64)]);

        await mount({
          src: '/dev/sda1',
          path: '/mnt/data',
          fstype: 'ext4',
        });

        expect(tracker.changed).toBe(true);
        const calls = getSpawnCalls(conn);
        expect(calls.length).toBe(1);
      },
      { dryRun: true },
    );
  });
});
