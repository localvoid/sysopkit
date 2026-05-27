import { describe, expect, test } from 'bun:test';
import { fakeTimers, withMockContext } from '@sysopkit/test-utils';
import { sleep, timeout, TimeoutError } from 'sysopkit';

describe('timeout', () => {
  test('basics', async () => {
    using t = fakeTimers();
    await withMockContext(async () => {
      const result = timeout(100, async () => {
        return 'success';
      });
      await t.advanceAll();

      expect(await result).toBe('success');
    });
  });

  test('aborts after timeoutMs', async () => {
    using t = fakeTimers();
    await withMockContext(async () => {
      try {
        const r = timeout(10, async () => {
          await sleep(100);
          expect.unreachable();
        });
        await t.advanceByTime(10);
        await r;
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
      }
    });
  });

  test('throws inner error', async () => {
    await withMockContext(async () => {
      try {
        await timeout(100, async () => {
          throw new Error('test error');
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('test error');
      }
    });
  });
});
