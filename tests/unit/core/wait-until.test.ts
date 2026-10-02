import { describe, expect, mock, test } from 'bun:test';
import { withMockContext } from '@sysopkit/test-utils';
import { AbortError, ConnectorError, isAbortError, TimeoutError, waitUntil } from 'sysopkit';
import { ShellError } from 'sysopkit/op/sh';

describe('waitUntil', () => {
  test('resolves on false-to-true transition', async () => {
    await withMockContext(async () => {
      let calls = 0;
      const check = mock(async () => ++calls >= 3);
      await waitUntil(check, { intervalMs: 10, timeoutMs: 1000, describe: 'ready' });
      expect(calls).toBe(3);
    });
  });

  test('retries default retryable errors then succeeds', async () => {
    await withMockContext(async ({ conn }) => {
      let calls = 0;
      await waitUntil(
        async () => {
          calls++;
          if (calls === 1) {
            throw new ConnectorError('connection refused', conn);
          }
          if (calls === 2) {
            throw new ShellError('ssh exit 255', ['ssh', 'host', 'true'], 255, '', '');
          }
          return true;
        },
        { intervalMs: 10, timeoutMs: 1000, describe: 'reboot' },
      );
      expect(calls).toBe(3);
      void conn;
    });
  });

  test('propagates non-retryable errors immediately', async () => {
    await withMockContext(async () => {
      let calls = 0;
      try {
        await waitUntil(
          async () => {
            calls++;
            throw new Error('boom-syntax');
          },
          { intervalMs: 10, timeoutMs: 1000, describe: 'fail-fast' },
        );
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('boom-syntax');
      }
      expect(calls).toBe(1);
    });
  });

  test('custom retryOn () => false fails fast on connection errors', async () => {
    await withMockContext(async ({ conn }) => {
      let calls = 0;
      try {
        await waitUntil(
          async () => {
            calls++;
            throw new ConnectorError('down', conn);
          },
          { intervalMs: 10, timeoutMs: 1000, describe: 'strict', retryOn: () => false },
        );
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ConnectorError);
      }
      expect(calls).toBe(1);
    });
  });

  test('times out with describe and cause', async () => {
    await withMockContext(async ({ conn }) => {
      const probeError = new ConnectorError('still down', conn);
      try {
        await waitUntil(
          async () => {
            throw probeError;
          },
          { intervalMs: 10, timeoutMs: 40, describe: 'rescue cmdline' },
        );
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
        expect((e as Error).message).toContain('rescue cmdline');
        expect((e as Error).message).toContain('40ms');
        expect((e as Error).cause).toBe(probeError);
      }
    });
  });

  test('times out on perpetual false without cause', async () => {
    await withMockContext(async () => {
      try {
        await waitUntil(async () => false, {
          intervalMs: 10,
          timeoutMs: 30,
          describe: 'never',
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
        expect((e as Error).message).toContain('never');
        expect((e as Error).cause).toBeUndefined();
      }
    });
  });

  test('propagates abort', async () => {
    await withMockContext(async () => {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(new AbortError('stop')), 20);
      try {
        await waitUntil(async () => false, {
          intervalMs: 10,
          timeoutMs: 5000,
          describe: 'abort',
          signal: ctrl.signal,
        });
        expect.unreachable();
      } catch (e) {
        expect(isAbortError(e)).toBe(true);
      }
    });
  });

  test('never swallows abort errors from check', async () => {
    await withMockContext(async () => {
      try {
        await waitUntil(
          async () => {
            throw new AbortError('stop');
          },
          { intervalMs: 10, timeoutMs: 1000, describe: 'abort-check' },
        );
        expect.unreachable();
      } catch (e) {
        expect(isAbortError(e)).toBe(true);
      }
    });
  });

  test('supports inequality predicates (boot-id change)', async () => {
    await withMockContext(async () => {
      const ids = ['aaa', 'aaa', 'bbb'];
      await waitUntil(async () => ids.shift() !== 'aaa', {
        intervalMs: 10,
        timeoutMs: 1000,
        describe: 'boot-id change',
      });
    });
  });

  test('refuses missing check inside the task context', async () => {
    await withMockContext(async (mockCtx) => {
      try {
        await waitUntil(void 0 as unknown as () => Promise<boolean>, {
          intervalMs: 10,
          timeoutMs: 50,
        });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('refusing: check() predicate is required');
      }
      const taskErr = mockCtx.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
    });
  });

  test('refuses bad timeoutMs inside the task context', async () => {
    await withMockContext(async (mockCtx) => {
      try {
        await waitUntil(async () => true, { timeoutMs: 0, intervalMs: 10 });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("refusing: bad timeoutMs '0'");
      }
      const taskErr = mockCtx.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
    });
  });

  test('refuses bad intervalMs inside the task context', async () => {
    await withMockContext(async (mockCtx) => {
      try {
        await waitUntil(async () => true, { timeoutMs: 50, intervalMs: 0 });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("refusing: bad intervalMs '0'");
      }
      const taskErr = mockCtx.reporter.ctxError.mock.calls.find(([ctx]) => ctx.type === 'task');
      expect(taskErr).toBeDefined();
    });
  });
});
