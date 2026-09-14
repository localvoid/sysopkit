import { jest } from 'bun:test';

/**
 * Advances fake timers until none remain, yielding to the microtask queue
 * between timers so chained timers (e.g. retry delays, polling loops) get
 * scheduled before the pending-timer check.
 *
 * Pair with `jest.useFakeTimers()` / `jest.useRealTimers()`. Unlike the
 * synchronous `jest.runAllTimers()`, this also drains timers that are
 * scheduled from promise continuations after the call.
 */
export async function drainFakeTimers(): Promise<void> {
  await Promise.resolve();
  while (jest.getTimerCount() > 0) {
    jest.advanceTimersToNextTimer();
    await Promise.resolve();
  }
}
