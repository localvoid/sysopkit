import { jest } from 'bun:test';

export function fakeTimers(now?: number | Date): FakeTimers {
  return new FakeTimers(now);
}

export class FakeTimers implements Disposable {
  readonly timers: ReturnType<typeof jest.useFakeTimers>;

  constructor(now: number | Date = 0) {
    this.timers = jest.useFakeTimers({ now });
  }

  async advanceAll(): Promise<void> {
    await Promise.resolve();
    while (this.timers.getTimerCount() > 0) {
      this.timers.advanceTimersToNextTimer();
      await Promise.resolve();
    }
  }

  advanceByTime(ms: number): Promise<void> {
    this.timers.advanceTimersByTime(ms);
    return Promise.resolve();
  }

  [Symbol.dispose](): void {
    this.timers.useRealTimers();
  }
}
