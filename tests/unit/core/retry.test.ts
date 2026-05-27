import { describe, expect, test } from 'bun:test';
import { fakeTimers, withMockContext } from '@sysopkit/test-utils';
import { AbortError, retry } from 'sysopkit';

describe('retry()', () => {
  describe('basic functionality', () => {
    test('returns result on success', async () => {
      await withMockContext(async () => {
        const result = await retry({ attempts: 3 }, async () => 'success');
        expect(result).toBe('success');
      });
    });

    test('retries on error up to attempts', async () => {
      using t = fakeTimers();
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry({ attempts: 2, delay: 10 }, async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('fail');
          }
          return 'done';
        });

        await t.advanceAll();
        const result = await promise;

        expect(result).toBe('done');
        expect(attempts).toBe(3);
      });
    });

    test('throws after max attempts', async () => {
      using t = fakeTimers();
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry({ attempts: 2, delay: 10 }, async () => {
          attempts++;
          throw new Error('always fails');
        });
        try {
          await t.advanceAll();
          await promise;
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toBe('always fails');
        }
        expect(attempts).toBe(3);
      });
    });

    test('returns immediately on success', async () => {
      await withMockContext(async () => {
        let attempts = 0;

        await retry({ attempts: 3 }, async () => {
          attempts++;
          return 'success';
        });

        expect(attempts).toBe(1);
      });
    });
  });

  describe('retryOn predicate', () => {
    test('retries when predicate returns true', async () => {
      using t = fakeTimers();
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry(
          {
            attempts: 2,
            delay: 10,
            retryOn: (err) => err.message.includes('retryable'),
          },
          async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('retryable error');
            }
            return 'done';
          },
        );

        await t.advanceAll();
        const result = await promise;

        expect(result).toBe('done');
        expect(attempts).toBe(3);
      });
    });

    test('does not retry when predicate returns false', async () => {
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry(
          {
            attempts: 3,
            delay: 10,
            retryOn: (err) => err.message.includes('transient'),
          },
          async () => {
            attempts++;
            throw new Error('permanent failure');
          },
        );
        try {
          await promise;
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toBe('permanent failure');
        }
        expect(attempts).toBe(1);
      });
    });
  });

  describe('backoff strategies', () => {
    test('fixed delay between retries', async () => {
      using t = fakeTimers();
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry({ attempts: 2, delay: 50, backoff: 'fixed' }, async () => {
          attempts++;
          throw new Error('fail');
        });
        try {
          await t.advanceAll();
          await promise;
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toBe('fail');
        }

        const elapsed = Date.now();
        expect(attempts).toBe(3);
        expect(elapsed).toBe(100);
      });
    });

    test('exponential backoff', async () => {
      using t = fakeTimers();
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry({ attempts: 2, delay: 100, backoff: 'exponential' }, async () => {
          attempts++;
          throw new Error('fail');
        });
        try {
          await t.advanceAll();
          await promise;
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toBe('fail');
        }

        const elapsed = Date.now();
        expect(attempts).toBe(3);
        expect(elapsed).toBe(600);
      });
    });

    test('maxDelay caps exponential backoff', async () => {
      using t = fakeTimers();
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry(
          { attempts: 3, delay: 100, backoff: 'exponential', maxDelay: 300 },
          async () => {
            attempts++;
            throw new Error('fail');
          },
        );
        try {
          await t.advanceAll();
          await promise;
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toBe('fail');
        }

        const elapsed = Date.now();
        expect(attempts).toBe(4);
        expect(elapsed).toBe(800);
      });
    });
  });

  describe('reporter integration', () => {
    test('calls reporter.retryAttempt with correct args', async () => {
      using t = fakeTimers();
      await withMockContext(async ({ reporter }) => {
        const promise = retry({ attempts: 1, delay: 10 }, async () => {
          throw new Error('connection refused');
        });
        try {
          await t.advanceAll();
          await promise;
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toBe('connection refused');
        }

        expect(reporter.retryAttempt).toHaveBeenCalledTimes(1);
        expect(reporter.retryAttempt.mock.calls[0][1]).toBe(1);
        expect(reporter.retryAttempt.mock.calls[0][2]).toBe(10);
        expect(reporter.retryAttempt.mock.calls[0][3].message).toBe('connection refused');
      });
    });
  });

  describe('abort handling', () => {
    test('stops retrying when context is aborted', async () => {
      using t = fakeTimers();
      await withMockContext(async ({ ctx }) => {
        let attempts = 0;
        const promise = retry({ attempts: 5, delay: 100 }, async () => {
          attempts++;
          if (attempts === 2) {
            ctx.abort('abort');
          }
          expect.unreachable();
        });
        try {
          await t.advanceAll();
          await promise;
          expect.unreachable();
        } catch (e) {
          expect(e).toBeInstanceOf(AbortError);
        }

        expect(attempts).toBe(2);
      });
    });
  });

  describe('error types', () => {
    test('does not retry AbortError', async () => {
      await withMockContext(async () => {
        let attempts = 0;

        try {
          await retry({ attempts: 3, delay: 10 }, async () => {
            attempts++;
            throw new AbortError('abort');
          });
          expect.unreachable();
        } catch (e) {
          expect(e).toBeInstanceOf(AbortError);
        }

        expect(attempts).toBe(1);
      });
    });

    test('retries Error', async () => {
      using t = fakeTimers();
      await withMockContext(async () => {
        let attempts = 0;

        const promise = retry({ attempts: 2, delay: 10 }, async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('retryable');
          }
          return 'done';
        });

        await t.advanceAll();
        const result = await promise;

        expect(result).toBe('done');
      });
    });
  });
});
