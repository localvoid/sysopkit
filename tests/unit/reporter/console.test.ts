import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createRootContext, type ExecutionContext, VERBOSITY_DEBUG } from 'sysopkit';
import { ConsoleReporter } from 'sysopkit/reporter/console';

describe('ConsoleReporter', () => {
  let stdoutSpy: ReturnType<typeof mock>;
  let stderrSpy: ReturnType<typeof mock>;
  let reporter: ConsoleReporter;
  let ctx: ExecutionContext;

  beforeEach(() => {
    stdoutSpy = mock(() => {});
    stderrSpy = mock(() => {});
    global.console = {
      ...console,
      log: stdoutSpy,
      error: stderrSpy,
    } as Console;
    reporter = new ConsoleReporter({ verbosity: VERBOSITY_DEBUG, color: false });
    ctx = createRootContext(reporter, false, {}, new AbortController().signal);
    reporter.ctxStart(ctx);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('info/warn/error buffering', () => {
    test('buffers info until ctxEnd', () => {
      reporter.info(ctx, 'test message');
      expect(stdoutSpy).toHaveBeenCalledTimes(0);

      reporter.ctxEnd(ctx);
      const stdoutCalls = stdoutSpy.mock.calls.map((c) => c[0]);
      expect(stdoutCalls.length).toBeGreaterThan(0);
      expect(stdoutCalls.some((c) => c.includes('test message'))).toBe(true);
    });

    test('buffers warn until ctxEnd', () => {
      reporter.warn(ctx, 'warning message');
      expect(stderrSpy).toHaveBeenCalledTimes(0);

      reporter.ctxEnd(ctx);
      const stderrCalls = stderrSpy.mock.calls.map((c) => c[0]);
      expect(stderrCalls.length).toBeGreaterThan(0);
      expect(stderrCalls.some((c) => c.includes('⚠'))).toBe(true);
    });

    test('buffers error until ctxEnd', () => {
      reporter.error(ctx, 'error message');
      expect(stderrSpy).toHaveBeenCalledTimes(0);

      reporter.ctxEnd(ctx);
      const stderrCalls = stderrSpy.mock.calls.map((c) => c[0]);
      expect(stderrCalls.length).toBeGreaterThan(0);
      expect(stderrCalls.some((c) => c.includes('✘'))).toBe(true);
    });
  });
});
