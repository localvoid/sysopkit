import { describe, expect, test } from 'bun:test';
import { MockConnector } from '@sysopkit/test-utils';
import {
  createConnectorContext,
  createRootContext,
  createTaskContext,
  VERBOSITY_DEBUG,
  VERBOSITY_NORMAL,
  type ExecutionContext,
} from 'sysopkit';
import { ConsoleReporter, type ConsoleStream } from 'sysopkit/reporter/console';
import {
  findSlotKey,
  resolveTuiEnabled,
  stripAnsi,
  truncateToWidth,
  type SlotContext,
} from 'sysopkit/reporter/tui';

function fakeStream(captured: string[], columns = 80): ConsoleStream {
  return {
    columns,
    isTTY: true,
    write(chunk: string) {
      captured.push(chunk);
      return true;
    },
  };
}

function makeReporter(opts?: {
  stdout?: ConsoleStream;
  stderr?: ConsoleStream;
  verbosity?: number;
}) {
  const stdoutCaptured: string[] = [];
  const stderrCaptured: string[] = [];
  const stdout = opts?.stdout ?? fakeStream(stdoutCaptured);
  const stderr = opts?.stderr ?? fakeStream(stderrCaptured);
  const reporter = new ConsoleReporter({
    verbosity: (opts?.verbosity ?? VERBOSITY_NORMAL) as any,
    color: false,
    tui: true,
    stdout,
    stderr,
    tuiIntervalMs: 60000,
  });
  return { reporter, stdoutCaptured, stderrCaptured };
}

function rootCtx(reporter: ConsoleReporter): ExecutionContext {
  const ctx = createRootContext(reporter, false, {}, new AbortController().signal);
  reporter.ctxStart(ctx);
  return ctx;
}

function connectorCtx(
  reporter: ConsoleReporter,
  parent: ExecutionContext,
  name: string,
): ExecutionContext {
  const conn = new MockConnector(name, name, void 0);
  const ctx = createConnectorContext(parent, conn, void 0, new AbortController().signal, name);
  reporter.ctxStart(ctx);
  return ctx;
}

function taskCtx(
  reporter: ConsoleReporter,
  parent: ExecutionContext,
  name: string,
): ExecutionContext {
  const ctx = createTaskContext(
    parent,
    void 0,
    new AbortController().signal,
    name,
    void 0,
    VERBOSITY_NORMAL,
  );
  reporter.ctxStart(ctx);
  return ctx;
}

describe('resolveTuiEnabled', () => {
  test('explicit false always disables', () => {
    expect(resolveTuiEnabled(false, {}, true)).toBe(false);
  });

  test('explicit true forces enable without TTY', () => {
    expect(resolveTuiEnabled(true, {}, false)).toBe(true);
    expect(resolveTuiEnabled(true, {}, void 0)).toBe(true);
  });

  test('auto requires TTY', () => {
    expect(resolveTuiEnabled('auto', {}, true)).toBe(true);
    expect(resolveTuiEnabled('auto', {}, false)).toBe(false);
    expect(resolveTuiEnabled('auto', {}, void 0)).toBe(false);
    expect(resolveTuiEnabled(void 0, {}, true)).toBe(true);
  });

  test('dumb terminal disables', () => {
    expect(resolveTuiEnabled('auto', { TERM: 'dumb' }, true)).toBe(false);
    expect(resolveTuiEnabled('auto', { TERM: 'xterm' }, true)).toBe(true);
    expect(resolveTuiEnabled('auto', {}, true)).toBe(true);
  });
});

describe('findSlotKey', () => {
  test('outermost connector wins over deeper tasks', () => {
    const root: SlotContext = { type: 'root', parent: null };
    const conn: SlotContext = { type: 'connector', parent: root };
    const t1: SlotContext = { type: 'task', parent: conn };
    const t2: SlotContext = { type: 'task', parent: t1 };
    expect(findSlotKey(t2)).toBe(conn);
    expect(findSlotKey(t1)).toBe(conn);
    expect(findSlotKey(conn)).toBe(conn);
  });

  test('nested connectors collapse to outermost', () => {
    const root: SlotContext = { type: 'root', parent: null };
    const outer: SlotContext = { type: 'connector', parent: root };
    const inner: SlotContext = { type: 'connector', parent: outer };
    const t: SlotContext = { type: 'task', parent: inner };
    expect(findSlotKey(t)).toBe(outer);
    expect(findSlotKey(inner)).toBe(outer);
  });

  test('pure tasks use outermost task', () => {
    const root: SlotContext = { type: 'root', parent: null };
    const a: SlotContext = { type: 'task', parent: root };
    const a1: SlotContext = { type: 'task', parent: a };
    const b: SlotContext = { type: 'task', parent: root };
    expect(findSlotKey(a1)).toBe(a);
    expect(findSlotKey(a)).toBe(a);
    expect(findSlotKey(b)).toBe(b);
  });
});

describe('stripAnsi/truncateToWidth', () => {
  test('strips SGR sequences', () => {
    expect(stripAnsi('\x1b[1mhi\x1b[22m')).toBe('hi');
  });

  test('fits unchanged, overlong truncated with ellipsis', () => {
    expect(truncateToWidth('abc', 5)).toBe('abc');
    const out = truncateToWidth(`\x1b[1m${'x'.repeat(20)}\x1b[22m`, 10);
    expect(stripAnsi(out).length).toBeLessThanOrEqual(10);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('ConsoleReporter TUI slots', () => {
  test('concurrent branches get stable slots, deeper tasks reuse slot', () => {
    const { reporter } = makeReporter();
    const root = rootCtx(reporter);
    const h1 = connectorCtx(reporter, root, 'host1');
    const h2 = connectorCtx(reporter, root, 'host2');

    let lines = reporter._buildTuiLines().map(stripAnsi);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('host1');
    expect(lines[1]).toContain('host2');

    const install = taskCtx(reporter, h1, 'install');
    lines = reporter._buildTuiLines().map(stripAnsi);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('host1');
    expect(lines[0]).toContain('install');
    expect(lines[1]).toContain('host2');

    const sub = taskCtx(reporter, install, 'write file');
    lines = reporter._buildTuiLines().map(stripAnsi);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('write file');
    expect(lines[1]).toContain('host2');

    reporter.ctxEnd(sub);
    reporter.ctxEnd(install);
    lines = reporter._buildTuiLines().map(stripAnsi);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('host1');

    reporter.ctxEnd(h1);
    lines = reporter._buildTuiLines().map(stripAnsi);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('host2');

    reporter.ctxEnd(h2);
    reporter.ctxEnd(root);
  });

  test('completion goes to stdout sink and footer is cleared', () => {
    const { reporter, stdoutCaptured, stderrCaptured } = makeReporter();
    const root = rootCtx(reporter);
    const h1 = connectorCtx(reporter, root, 'host1');
    const t = taskCtx(reporter, h1, 'install');

    stdoutCaptured.length = 0;
    stderrCaptured.length = 0;

    reporter.ctxEnd(t);

    const out = stdoutCaptured.join('');
    expect(out).toContain('install');
    expect(out).toContain('✓');
    // footer clear sequence emitted before the log line
    expect(stderrCaptured.join('')).toContain('\x1b[');

    reporter.ctxEnd(h1);
    reporter.ctxEnd(root);
  });

  test('auto mode stays disabled without TTY', () => {
    const captured: string[] = [];
    const reporter = new ConsoleReporter({
      verbosity: VERBOSITY_NORMAL,
      color: false,
      tui: 'auto',
      stdout: fakeStream(captured),
      stderr: { write: () => true, isTTY: false },
    });
    expect(reporter.tuiEnabled).toBe(false);
  });

  test('utility contexts do not affect footer', () => {
    const { reporter } = makeReporter({ verbosity: VERBOSITY_DEBUG });
    const root = rootCtx(reporter);
    const h1 = connectorCtx(reporter, root, 'host1');
    const before = reporter._buildTuiLines().map(stripAnsi);
    expect(before).toHaveLength(1);

    // DEBUG utility under the task branch is tracked but filtered at NORMAL verbosity? No,
    // with DEBUG verbosity it is visible; check NORMAL reporter instead.
    reporter.ctxEnd(h1);
    reporter.ctxEnd(root);

    const { reporter: r2 } = makeReporter({ verbosity: VERBOSITY_NORMAL });
    const root2 = rootCtx(r2);
    const c2 = connectorCtx(r2, root2, 'host1');
    const t2 = taskCtx(r2, c2, 'install');
    // simulate a utility child (DEBUG) which should be hidden at NORMAL
    const util = createTaskContext(
      t2,
      void 0,
      new AbortController().signal,
      'helper',
      void 0,
      VERBOSITY_DEBUG,
    );
    // bump type to utility via manual object (createTaskContext makes task; use real utility path)
    (util as any).type = 'utility';
    r2.ctxStart(util);
    const lines = r2._buildTuiLines().map(stripAnsi);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('install');
    r2.ctxEnd(util);
    r2.ctxEnd(t2);
    r2.ctxEnd(c2);
    r2.ctxEnd(root2);
  });
});
