import { describe, expect, test } from 'bun:test';
import { Readable } from 'node:stream';
import { fakeTimers, mockSpawn, withMockContext } from '@sysopkit/test-utils';
import { timeout, TimeoutError } from 'sysopkit';
import { _pathInfoCmd, waitFileContent, waitFilePath } from 'sysopkit/op/file';
import { waitProcess } from 'sysopkit/op/proc';

const PATH_INFO_EXISTS = '12';
const PATH_INFO_NOT_EXISTS = '0';

function mockPathNotExists() {
  return {
    stdin: new WritableStream(),
    stdout: Readable.toWeb(Readable.from(PATH_INFO_NOT_EXISTS)),
    stderr: Readable.toWeb(Readable.from('')),
    exited: Promise.resolve(0),
    kill: () => {},
  };
}

function mockProcessNotFound() {
  return {
    stdin: new WritableStream(),
    stdout: Readable.toWeb(Readable.from('')),
    stderr: Readable.toWeb(Readable.from('')),
    exited: Promise.resolve(64),
    kill: () => {},
  };
}

describe('waitPath', () => {
  test('resolves when path exists', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [{ cmd: ['sh', '-c', _pathInfoCmd('/tmp/file')], stdout: PATH_INFO_EXISTS }]);

      await waitFilePath({ path: '/tmp/file' });
    });
  });

  test('resolves when path becomes present', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        { cmd: ['sh', '-c', _pathInfoCmd('/tmp/file')], stdout: PATH_INFO_NOT_EXISTS },
        { cmd: ['sh', '-c', _pathInfoCmd('/tmp/file')], stdout: PATH_INFO_NOT_EXISTS },
        { cmd: ['sh', '-c', _pathInfoCmd('/tmp/file')], stdout: PATH_INFO_EXISTS },
      ]);

      await waitFilePath({ path: '/tmp/file', delay: 10 });
    });
  });

  test('throws on timeout', async () => {
    using t = fakeTimers();

    await withMockContext(async ({ conn }) => {
      conn.spawn.mockImplementation(async () => mockPathNotExists());
      const promise = timeout(50, async () => {
        await waitFilePath({ path: '/tmp/file', delay: 10 });
      });
      try {
        await t.advanceAll();
        await promise;
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
      }
    });
  });
});

describe('waitFileContent', () => {
  test('waits for pattern in file', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        { cmd: ['sh', '-c', "grep -q 'Server started' /var/log/app.log||exit 64"], exitCode: 64 },
        { cmd: ['sh', '-c', "grep -q 'Server started' /var/log/app.log||exit 64"], exitCode: 0 },
      ]);

      await waitFileContent({ path: '/var/log/app.log', regex: 'Server started', delay: 10 });
    });
  });

  test('waits for pattern to be absent', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        { cmd: ['sh', '-c', 'grep -q error /var/log/app.log||exit 64'], exitCode: 0 },
        { cmd: ['sh', '-c', 'grep -q error /var/log/app.log||exit 64'], exitCode: 64 },
      ]);

      await waitFileContent({
        path: '/var/log/app.log',
        regex: 'error',
        state: 'absent',
        delay: 10,
      });
    });
  });
});

describe('waitProcess', () => {
  test('resolves when process is present', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        { cmd: ['sh', '-c', 'pidof nginx;[ $? -eq 1 ]&&exit 64||exit $?'], exitCode: 0 },
      ]);

      await waitProcess({ process: 'nginx' });
    });
  });

  test('resolves when process becomes present', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        { cmd: ['sh', '-c', 'pidof nginx;[ $? -eq 1 ]&&exit 64||exit $?'], exitCode: 64 },
        { cmd: ['sh', '-c', 'pidof nginx;[ $? -eq 1 ]&&exit 64||exit $?'], exitCode: 64 },
        { cmd: ['sh', '-c', 'pidof nginx;[ $? -eq 1 ]&&exit 64||exit $?'], exitCode: 0 },
      ]);

      await waitProcess({ process: 'nginx', delay: 10 });
    });
  });

  test('throws on timeout', async () => {
    using t = fakeTimers();

    await withMockContext(async ({ conn }) => {
      conn.spawn.mockImplementation(async () => mockProcessNotFound());

      const promise = timeout(50, async () => {
        await waitProcess({ process: 'nginx', delay: 10 });
      });
      try {
        await t.advanceAll();
        await promise;
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
      }
    });
  });

  test('waits for process to be absent', async () => {
    await withMockContext(async ({ conn }) => {
      mockSpawn(conn, [
        { cmd: ['sh', '-c', 'pidof nginx;[ $? -eq 1 ]&&exit 64||exit $?'], exitCode: 0 },
        { cmd: ['sh', '-c', 'pidof nginx;[ $? -eq 1 ]&&exit 64||exit $?'], exitCode: 64 },
      ]);

      await waitProcess({ process: 'nginx', state: 'absent', delay: 10 });
    });
  });
});
