import { describe, expect, test } from 'bun:test';
import { getSpawnCalls, mockSpawn, withMockContext } from '@sysopkit/test-utils';
import { curl } from 'sysopkit/op/curl';

// Unit scope: command construction only. Real downloads (file://,
// http, redirects, 404s) are covered in tests/e2e/ops/proc-net.test.ts.

describe('curl', () => {
  test('bare download emits curl -o', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [{ cmd: ['sh', '-c', 'curl -o /dst/file http://mirror/x'] }]);

      await curl({ url: 'http://mirror/x', path: '/dst/file' });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('fail+followRedirects+silent emits curl -f -L -sS -o', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [{ cmd: ['sh', '-c', 'curl -f -L -sS -o /dst/file http://mirror/x'] }]);

      await curl({
        url: 'http://mirror/x',
        path: '/dst/file',
        fail: true,
        followRedirects: true,
        silent: true,
      });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });

  test('existing auth/header/cookie/insecure flags keep working', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        {
          cmd: [
            'sh',
            '-c',
            "curl -f -u user:pass -H X-A:1 -b 'c=v' -k -o /dst/file https://mirror/x",
          ],
        },
      ]);

      await curl({
        url: 'https://mirror/x',
        path: '/dst/file',
        user: 'user:pass',
        headers: ['X-A:1'],
        cookies: 'c=v',
        insecure: 'yes',
        fail: true,
      });

      expect(getSpawnCalls(conn)).toHaveLength(1);
    });
  });
});
