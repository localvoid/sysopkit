import { afterEach, describe, expect, jest, test } from 'bun:test';
import { withMockContext } from '@sysopkit/test-utils';
import { sleep, timeout, TimeoutError } from 'sysopkit';

import { drainFakeTimers } from '../timers.js';

describe('timeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  test('basics', async () => {
    jest.useFakeTimers({ now: 0 });
    await withMockContext(async () => {
      const result = timeout(100, async () => {
        return 'success';
      });
      await drainFakeTimers();

      expect(await result).toBe('success');
    });
  });

  test('aborts after timeoutMs', async () => {
    jest.useFakeTimers({ now: 0 });
    await withMockContext(async () => {
      try {
        const r = timeout(10, async () => {
          await sleep(100);
          expect.unreachable();
        });
        jest.advanceTimersByTime(10);
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
