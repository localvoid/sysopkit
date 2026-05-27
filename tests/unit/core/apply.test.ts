import { describe, expect, test } from 'bun:test';
import { apply, ApplyError, context } from 'sysopkit';
import { LocalConnector } from 'sysopkit/connector/local';
import { start } from 'sysopkit/start';

describe('apply()', () => {
  test('throws ApplyError on single connection failure', async () => {
    await start(async () => {
      await using conn = new LocalConnector();

      try {
        await apply('test', conn, async () => {
          throw new Error('connection failed');
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ApplyError);
        const err = e as ApplyError;
        expect(err.results).toHaveLength(1);
        expect(err.results[0].success).toBe(false);
        expect(err.results[0].conn.name).toBe('local:');
      }
    });
  });

  test('throws ApplyError when failures exceed threshold', async () => {
    await start(async () => {
      await using host1 = new LocalConnector();
      await using host2 = new LocalConnector();
      await using host3 = new LocalConnector();

      try {
        await apply(
          'test',
          [host1, host2, host3],
          async () => {
            if (context().conn!.name !== 'host1') {
              throw new Error('fail');
            }
          },
          { maxFailPercent: 0 },
        );
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ApplyError);
        const err = e as ApplyError;
        expect(err.results.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test('returns results when failures within threshold', async () => {
    await start(async () => {
      await using host1 = new LocalConnector();
      await using host2 = new LocalConnector();
      await using host3 = new LocalConnector();

      const results = await apply(
        'test',
        [host1, host2, host3],
        async () => {
          if (context().conn!.name === 'host2') {
            throw new Error('fail on host2');
          }
        },
        { maxFailPercent: 50 },
      );

      expect(results).toHaveLength(3);
      const failures = results.filter((r) => !r.success);
      expect(failures).toHaveLength(1);
    });
  });
});
