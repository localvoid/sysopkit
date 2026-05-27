import { describe, expect, test } from 'bun:test';
import { withMockContext, mockSpawn, trackChanged } from '@sysopkit/test-utils';
import { context, emitChanged, type Process } from 'sysopkit';
import { trace } from 'sysopkit/middleware/trace';

async function drainStreams(proc: Process): Promise<{ stdout: string; stderr: string }> {
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr };
}

describe('trace()', () => {
  test('on() hook receives stdout content on flush', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [{ cmd: ['echo', 'hello'], stdout: 'hello\n' }]);

      let stdoutContent: string | undefined;
      await trace(
        async () => {
          const proc = await context().conn!.spawn(['echo', 'hello']);
          await drainStreams(proc);
        },
        {
          on(type, content) {
            if (type === 'stdout') {
              stdoutContent = content;
            }
          },
        },
      );

      expect(stdoutContent).toBe('hello');
    });
  });

  test('on() hook receives stderr content on flush', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [{ cmd: ['cmd'], stderr: 'error output\n' }]);

      let stderrContent: string | undefined;
      await trace(
        async () => {
          const proc = await context().conn!.spawn(['cmd']);
          await drainStreams(proc);
        },
        {
          on(type, content) {
            if (type === 'stderr') {
              stderrContent = content;
            }
          },
        },
      );

      expect(stderrContent).toBe('error output');
    });
  });

  test('on() hook can detect strings and emit change events', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [{ cmd: ['check'], stdout: 'CHANGED: /etc/config\n' }]);

      const tracker = trackChanged();
      await trace(
        async () => {
          const proc = await context().conn!.spawn(['check']);
          await drainStreams(proc);
        },
        {
          on(_type, content) {
            if (content.includes('CHANGED:')) {
              const resource = content.replace('CHANGED: ', '').trim();
              emitChanged({ type: 'trace', resource, property: 'detected' });
            }
          },
        },
      );

      expect(tracker.changed).toBe(true);
    });
  });

  test('on() hook is not called when output is empty', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [{ cmd: ['silent'], stdout: '', stderr: '' }]);

      let called = false;
      await trace(
        async () => {
          const proc = await context().conn!.spawn(['silent']);
          await drainStreams(proc);
        },
        {
          on() {
            called = true;
          },
        },
      );

      expect(called).toBe(false);
    });
  });

  test('on() hook receives both stdout and stderr', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [{ cmd: ['both'], stdout: 'out\n', stderr: 'err\n' }]);

      const calls: { type: string; content: string }[] = [];
      await trace(
        async () => {
          const proc = await context().conn!.spawn(['both']);
          await drainStreams(proc);
        },
        {
          on(type, content) {
            calls.push({ type, content });
          },
        },
      );

      expect(calls).toHaveLength(2);
      expect(calls).toContainEqual({ type: 'stdout', content: 'out' });
      expect(calls).toContainEqual({ type: 'stderr', content: 'err' });
    });
  });

  test('existing reporter behavior unchanged when on() is provided', async () => {
    await withMockContext(async (mock) => {
      mockSpawn(mock.conn, [{ cmd: ['test'], stdout: 'output\n', stderr: 'warning\n' }]);

      await trace(
        async () => {
          const proc = await context().conn!.spawn(['test']);
          await drainStreams(proc);
        },
        {
          on() {},
        },
      );

      expect(mock.reporter.info).toHaveBeenCalled();
      expect(mock.reporter.error).toHaveBeenCalled();
    });
  });
});
