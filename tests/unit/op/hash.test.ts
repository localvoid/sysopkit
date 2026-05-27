import { describe, expect, test } from 'bun:test';
import { mockSpawn, withMockContext } from '@sysopkit/test-utils';
import { sha256 } from 'sysopkit/op/file';

describe('sha256', () => {
  test('returns hash string', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        {
          cmd: ['sh', '-c', 'sha256sum /etc/hostname'],
          stdout:
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  /etc/hostname\n',
          exitCode: 0,
        },
      ]);

      const result = await sha256('/etc/hostname');

      expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  test('parses output correctly with spaces', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        {
          cmd: ['sh', '-c', 'sha256sum testfile.txt'],
          stdout: 'abc123def456  testfile.txt\n',
          exitCode: 0,
        },
      ]);

      const result = await sha256('testfile.txt');

      expect(result).toBe('abc123def456');
    });
  });

  test('throws on non-existent file', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        {
          cmd: ['sh', '-c', 'sha256sum /nonexistent'],
          stdout: 'sha256sum: /nonexistent: No such file or directory\n',
          exitCode: 1,
        },
      ]);

      try {
        await sha256('/nonexistent');
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  test('handles binary mode output', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        {
          cmd: ['sh', '-c', 'sha256sum file.bin'],
          stdout: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 *file.bin\n',
          exitCode: 0,
        },
      ]);

      const result = await sha256('file.bin');

      expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });
});
