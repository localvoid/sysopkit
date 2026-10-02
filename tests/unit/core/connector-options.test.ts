import { describe, expect, test } from 'bun:test';
import { MockReporter, withMockContext } from '@sysopkit/test-utils';
import {
  ConnectorMiddleware,
  context,
  createConnectorContext,
  createRootContext,
  middleware,
  runWithContext,
  updateConnectorOptions,
  type Connector,
} from 'sysopkit';
import { SSHConnector } from 'sysopkit/connector/ssh';

class PassthroughMiddleware extends ConnectorMiddleware {}

describe('updateConnectorOptions', () => {
  test('passes the current connector and returns fn result', async () => {
    await withMockContext(async (mock) => {
      const result = updateConnectorOptions((conn) => {
        expect(conn).toBe(mock.conn);
        return 'ok';
      });
      expect(result).toBe('ok');
    });
  });

  test('unwraps middleware chain to the base connector', async () => {
    await withMockContext(async (mock) => {
      await middleware(
        'outer',
        async () => {
          await middleware(
            'inner',
            async () => {
              const seen = updateConnectorOptions((conn) => conn);
              expect(seen).toBe(mock.conn);
            },
            (next) => new PassthroughMiddleware(next),
          );
        },
        (next) => new PassthroughMiddleware(next),
      );
    });
  });

  test('supports instanceof narrowing for SSHConnector', async () => {
    const reporter = new MockReporter();
    const abort = new AbortController();
    const root = createRootContext(reporter, false, {}, abort.signal);
    await runWithContext(abort, root, async () => {
      const conn = new SSHConnector({ host: 'localhost', user: 'testuser', controlMaster: false });
      try {
        const ctrl = new AbortController();
        const signal = AbortSignal.any([abort.signal, ctrl.signal]);
        const ctx = createConnectorContext(context(), conn, void 0, signal, conn.name);
        await runWithContext(ctrl, ctx, async () => {
          await middleware(
            'wrap',
            async () => {
              updateConnectorOptions((c: Connector) => {
                if (c instanceof SSHConnector) {
                  c.disableStrictHostKeyChecking();
                } else {
                  expect.unreachable();
                }
              });
            },
            (next) => new PassthroughMiddleware(next),
          );
          expect(conn.strictHostKeyChecking).toBe(false);
        });
      } finally {
        await conn[Symbol.asyncDispose]();
      }
    });
  });

  test('throws without a current connector', async () => {
    const reporter = new MockReporter();
    const abort = new AbortController();
    const root = createRootContext(reporter, false, {}, abort.signal);
    await runWithContext(abort, root, async () => {
      try {
        updateConnectorOptions(() => {});
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("doesn't have a connector");
      }
    });
  });

  test('refuses non-function input', async () => {
    await withMockContext(async () => {
      try {
        updateConnectorOptions(void 0 as unknown as (conn: Connector) => void);
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain('requires a function');
      }
    });
  });
});
