/**
 * @module reporter/console
 *
 * Terminal output reporter with color support and hierarchical context display.
 */

import { type ExecutionContext } from '../core/context.js';
import { CHANGE_EVENT, type ChangeEntry, type Event } from '../core/events.js';
import { VERBOSITY_DEBUG, type Reporter, type Verbosity } from '../core/reporter.js';
import { ExecError } from '../utils/process.js';
import { $_ } from '../utils/shell.js';
import {
  findSlotKey,
  resolveTuiEnabled,
  SPINNER_FRAMES,
  truncateToWidth,
  type TuiMode,
} from './tui.js';

/** Minimal writable stream for ConsoleReporter output (allows test doubles). */
export interface ConsoleStream {
  write(chunk: string): boolean | void;
  readonly columns?: number;
  readonly isTTY?: boolean;
}

/** Configuration options for ConsoleReporter. */
export interface ConsoleReporterOptions {
  readonly color?: boolean;
  readonly verbosity: Verbosity;
  /**
   * Live footer mode showing currently running tasks at the bottom.
   *
   * - `'auto'` (default): enabled only on an interactive terminal (`stderr`
   *   is a TTY) unless the standard `TERM=dumb` variable is set.
   * - `true`: force enable (even without TTY, useful for tests).
   * - `false`: disable.
   */
  readonly tui?: TuiMode | undefined;
  /** Stdout sink. Defaults to `process.stdout`. */
  readonly stdout?: ConsoleStream | undefined;
  /** Stderr sink (also carries the TUI footer). Defaults to `process.stderr`. */
  readonly stderr?: ConsoleStream | undefined;
  /** Footer refresh interval in ms. Defaults to 100. */
  readonly tuiIntervalMs?: number | undefined;
}

/**
 * Reporter that writes formatted output to the terminal.
 *
 * Displays hierarchical context information with timing, color-coded status
 * indicators, and buffered output that prints on context completion.
 *
 * When TUI mode is enabled (interactive terminal, see `tui` option), a live
 * footer at the bottom shows one line per concurrent branch. Deeper tasks
 * reuse their branch slot so each host stays at a stable position.
 */
export class ConsoleReporter implements Reporter {
  /** Minimum verbosity level for output. */
  readonly verbosity: Verbosity;
  /** Whether the live footer is enabled (resolved from `tui` option + env). */
  readonly tuiEnabled: boolean;
  private readonly useColor: boolean;
  private readonly details: WeakMap<ExecutionContext, ContextDetails>;
  private readonly active: Map<ExecutionContext, ContextDetails>;
  private readonly errorContexts: WeakMap<any, ContextDetails>;
  private readonly displayedErrors: WeakSet<any>;
  private readonly outStdout: ConsoleStream;
  private readonly outStderr: ConsoleStream;
  private readonly tuiIntervalMs: number;
  private tuiTimer: ReturnType<typeof setInterval> | undefined;
  private footerLines: number;
  private spinner: number;
  private _p: Palette;

  constructor(options?: ConsoleReporterOptions) {
    this.useColor = options?.color ?? process.stdout.isTTY ?? false;
    this.verbosity = options?.verbosity ?? 1;
    this.details = new WeakMap();
    this.active = new Map();
    this.errorContexts = new WeakMap();
    this.displayedErrors = new WeakSet();
    this._p = _createPalette(this.useColor);
    this.outStdout = options?.stdout ?? (process.stdout as unknown as ConsoleStream);
    this.outStderr = options?.stderr ?? (process.stderr as unknown as ConsoleStream);
    this.tuiIntervalMs = options?.tuiIntervalMs ?? 100;
    this.footerLines = 0;
    this.spinner = 0;
    this.tuiTimer = void 0;
    this.tuiEnabled = resolveTuiEnabled(
      options?.tui ?? 'auto',
      process.env,
      this.outStderr.isTTY ?? process.stderr?.isTTY,
    );
    if (this.tuiEnabled) {
      this._startTuiTimer();
    }
  }

  /** Registers a new execution context and records its start time. */
  ctxStart(ctx: ExecutionContext): void {
    let parent;
    let depth = 0;
    if (ctx.parent !== null) {
      parent = this.details.get(ctx.parent);
      if (parent === void 0) {
        throw new Error('invalid reporter state: parent context should be registered');
      }
      depth = parent.depth + 1;
    }

    const record: ContextDetails = {
      parent,
      ctx,
      prefix: this._getDisplayPrefix(ctx),
      depth,
      startTime: Date.now(),
      outputs: [],
      error: void 0,
    };
    this.details.set(ctx, record);
    this.active.set(ctx, record);
    if (this.tuiEnabled) {
      this._ensureTuiTimer();
      this._refreshFooter();
    }
  }

  /** Finalizes a context, printing status and buffered output if verbosity allows. */
  ctxEnd(ctx: ExecutionContext): void {
    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }
    this.active.delete(ctx);

    if (this.verbosity < ctx.verbosity) {
      const parent = details.parent;
      if (parent !== void 0) {
        parent.outputs.push(...details.outputs);
      }
      if (this.tuiEnabled) {
        this._refreshFooter();
        if (ctx.type === 'root') {
          this._stopTuiTimer();
        }
      }
      return;
    }

    if (!this.tuiEnabled) {
      const prefix = details.prefix;
      if (ctx.type !== 'root') {
        const duration = this._formatDuration(Date.now() - details.startTime);
        if (details.error === void 0) {
          const symbol = this._p.green('✓');
          this._stdout(`${symbol} ${prefix} \x1b[2m(${duration})\x1b[0m`);
        } else {
          const symbol = this._p.red('✗');
          this._stdout(`${symbol} ${prefix} \x1b[2m(${duration})\x1b[0m`);
        }
      }

      for (const output of details.outputs) {
        this._outputEntry(output);
      }
      return;
    }

    this._clearFooter();
    try {
      const prefix = details.prefix;
      if (ctx.type !== 'root') {
        const duration = this._formatDuration(Date.now() - details.startTime);
        if (details.error === void 0) {
          const symbol = this._p.green('✓');
          this._writeStdoutRaw(`${symbol} ${prefix} \x1b[2m(${duration})\x1b[0m`);
        } else {
          const symbol = this._p.red('✗');
          this._writeStdoutRaw(`${symbol} ${prefix} \x1b[2m(${duration})\x1b[0m`);
        }
      }

      for (const output of details.outputs) {
        this._outputEntryRaw(output);
      }
    } finally {
      this._drawFooter();
      if (ctx.type === 'root') {
        this._stopTuiTimer();
      }
    }
  }

  /** Records an error for a context and associates it with its context chain. */
  ctxError(ctx: ExecutionContext, error: any): void {
    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }
    details.error = error;
    if (!this.errorContexts.has(error)) {
      this.errorContexts.set(error, details);
    }
    details.outputs.push({ type: 'exception', error });
  }

  /** Buffers a change event for display when the context completes. */
  onEvent<T>(ctx: ExecutionContext, event: Event<T>, data: T): void {
    if (event !== CHANGE_EVENT) {
      return;
    }

    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }
    if (Array.isArray(data)) {
      for (const entry of data as ChangeEntry[]) {
        details.outputs.push({ type: 'change', entry });
      }
    } else {
      details.outputs.push({ type: 'change', entry: data as ChangeEntry });
    }
  }

  spawn(ctx: ExecutionContext, cmd: string[]): void {
    if (this.verbosity >= VERBOSITY_DEBUG) {
      this._stderr(
        `${this._p.bold('[SPAWN]')} ${cmd.map((s) => $_(s.replaceAll('\n', this._p.dim('\\n')))).join(' ')}`,
      );
    }
  }

  /** Immediately prints a retry attempt notification. */
  retryAttempt(ctx: ExecutionContext, attempt: number, delay: number, error: any): void {
    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }
    const prefix = details.prefix;
    const symbol = this._p.yellow('↻');
    this._stdout(`${symbol} ${prefix} retry ${attempt} (${delay}ms): ${error.message}`);
  }

  /** Buffers an informational message for display when the context completes. */
  info(ctx: ExecutionContext, message: string): void {
    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }
    details.outputs.push({ type: 'info', message });
  }

  /** Buffers a warning message for display when the context completes. */
  warn(ctx: ExecutionContext, message: string): void {
    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }
    details.outputs.push({ type: 'warn', message });
  }

  /** Buffers an error message for display when the context completes. */
  error(ctx: ExecutionContext, message: string): void {
    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }
    details.outputs.push({ type: 'error', message });
  }

  private _outputEntry(entry: OutputEntry): void {
    switch (entry.type) {
      case 'info':
        this._stdout(`  ${this._p.cyan('🛈')} ${entry.message}`);
        break;
      case 'warn':
        this._stderr(`  ${this._p.yellow('⚠')} ${entry.message}`);
        break;
      case 'error':
        this._stderr(`  ${this._p.red('✘')} ${entry.message}`);
        break;
      case 'change': {
        const line = this._formatChangeEntry(entry.entry);
        this._stdout(`  ${this._p.green('✓')} ${line}`);
        break;
      }
      case 'exception': {
        const error = entry.error;
        if (!this.displayedErrors.has(error)) {
          const errorCtx = this.errorContexts.get(error);
          if (errorCtx === void 0) {
            throw new Error(`invalid state, error should have context`);
          }
          this.displayedErrors.add(error);
          this._stderr(this._formatError(errorCtx).join('\n'));
        }
        break;
      }
    }
  }

  private _outputEntryRaw(entry: OutputEntry): void {
    switch (entry.type) {
      case 'info':
        this._writeStdoutRaw(`  ${this._p.cyan('🛈')} ${entry.message}`);
        break;
      case 'warn':
        this._writeStderrRaw(`  ${this._p.yellow('⚠')} ${entry.message}`);
        break;
      case 'error':
        this._writeStderrRaw(`  ${this._p.red('✘')} ${entry.message}`);
        break;
      case 'change': {
        const line = this._formatChangeEntry(entry.entry);
        this._writeStdoutRaw(`  ${this._p.green('✓')} ${line}`);
        break;
      }
      case 'exception': {
        const error = entry.error;
        if (!this.displayedErrors.has(error)) {
          const errorCtx = this.errorContexts.get(error);
          if (errorCtx === void 0) {
            throw new Error(`invalid state, error should have context`);
          }
          this.displayedErrors.add(error);
          this._writeStderrRaw(this._formatError(errorCtx).join('\n'));
        }
        break;
      }
    }
  }

  private _formatChangeEntry(entry: ChangeEntry): string {
    if (entry.from !== void 0 && entry.to !== void 0) {
      return `[${entry.type}] ${entry.resource}: ${entry.property} ${entry.from} → ${entry.to}`;
    }
    if (entry.to !== void 0) {
      return `[${entry.type}] ${entry.resource}: ${entry.property} → ${entry.to}`;
    }
    return `[${entry.type}] ${entry.resource}: ${entry.property}`;
  }

  private _stdout(message: string): void {
    if (!this.tuiEnabled) {
      console.log(message);
      return;
    }
    this._clearFooter();
    try {
      this._writeStdoutRaw(message);
    } finally {
      this._drawFooter();
    }
  }

  private _stderr(message: string): void {
    if (!this.tuiEnabled) {
      console.error(message);
      return;
    }
    this._clearFooter();
    try {
      this._writeStderrRaw(message);
    } finally {
      this._drawFooter();
    }
  }

  private _writeStdoutRaw(message: string): void {
    this.outStdout.write(message.endsWith('\n') ? message : `${message}\n`);
  }

  private _writeStderrRaw(message: string): void {
    this.outStderr.write(message.endsWith('\n') ? message : `${message}\n`);
  }

  private _tuiColumns(): number {
    return this.outStderr.columns ?? this.outStdout.columns ?? process.stdout.columns ?? 80;
  }

  private _startTuiTimer(): void {
    if (this.tuiTimer !== void 0) {
      return;
    }
    const timer = setInterval(() => this._tuiTick(), this.tuiIntervalMs);
    const maybeUnref = (timer as unknown as { unref?: () => void }).unref;
    if (typeof maybeUnref === 'function') {
      maybeUnref.call(timer);
    }
    this.tuiTimer = timer;
  }

  private _ensureTuiTimer(): void {
    if (this.tuiEnabled && this.tuiTimer === void 0) {
      this._startTuiTimer();
    }
  }

  private _stopTuiTimer(): void {
    if (this.tuiTimer !== void 0) {
      clearInterval(this.tuiTimer);
      this.tuiTimer = void 0;
    }
    this._clearFooter();
  }

  private _tuiTick(): void {
    if (!this.tuiEnabled) {
      return;
    }
    this.spinner += 1;
    this._refreshFooter();
  }

  private _refreshFooter(): void {
    this._clearFooter();
    this._drawFooter();
  }

  private _clearFooter(): void {
    if (!this.tuiEnabled || this.footerLines === 0) {
      return;
    }
    this.outStderr.write(`\x1b[${this.footerLines}A\x1b[J`);
    this.footerLines = 0;
  }

  private _drawFooter(): void {
    if (!this.tuiEnabled) {
      return;
    }
    const lines = this._buildTuiLines();
    if (lines.length === 0) {
      return;
    }
    this.outStderr.write(`${lines.join('\n')}\n`);
    this.footerLines = lines.length;
  }

  /** Builds current footer lines without writing (useful for tests). */
  _buildTuiLines(now: number = Date.now()): string[] {
    const groups = new Map<ExecutionContext, TuiGroup>();
    for (const [ctx, record] of this.active) {
      if (ctx.type !== 'task' && ctx.type !== 'connector') {
        continue;
      }
      if (this.verbosity < ctx.verbosity) {
        continue;
      }
      const slot = findSlotKey(ctx) as ExecutionContext;
      const slotRecord = this.active.get(slot) ?? this.details.get(slot);
      const startTime = slotRecord?.startTime ?? record.startTime;
      const existing = groups.get(slot);
      if (existing === void 0) {
        groups.set(slot, {
          key: slot,
          startTime,
          deepest: ctx,
          depth: record.depth,
          prefix: record.prefix,
        });
      } else if (record.depth > existing.depth) {
        existing.deepest = ctx;
        existing.depth = record.depth;
        existing.prefix = record.prefix;
      }
    }

    const columns = this._tuiColumns();
    const frame = SPINNER_FRAMES[this.spinner % SPINNER_FRAMES.length];
    const lines: string[] = [];
    for (const group of groups.values()) {
      const duration = this._formatDuration(now - group.startTime);
      const line = `${this._p.cyan(frame)} ${group.prefix} ${this._p.dim(`(${duration})`)}`;
      lines.push(truncateToWidth(line, columns));
    }
    return lines;
  }

  _getDisplayPrefix(ctx: ExecutionContext): string {
    const parts: string[] = [];

    let current: ExecutionContext | null = ctx;

    while (current !== null) {
      if (current.name) {
        if (current.type === 'connector') {
          parts.push(this._p.cyanBold(current.name));
        } else if (this.verbosity >= current.verbosity) {
          parts.push(this._p.bold(current.name));
        }
      }
      current = current.parent;
    }

    parts.reverse();
    return parts.join(' › ');
  }

  _formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m${remainingSeconds}s`;
  }

  _formatError(details: ContextDetails): string[] {
    const lines = [];

    const stack = [];
    let current: ContextDetails | undefined = details;
    while (current.parent !== void 0) {
      stack.push(current);
      current = current.parent;
    }
    stack.reverse();
    for (let i = 0; i < stack.length; i++) {
      const details = stack[i];
      const ctx = details.ctx;

      let inlineInfo = '';
      let infoLines: string[] | undefined;
      if (ctx.details) {
        const v = typeof ctx.details === 'function' ? ctx.details() : ctx.details;
        if (typeof v === 'string') {
          inlineInfo += ` (${v})`;
        } else {
          const indent = '  '.repeat(i + 1);
          infoLines = [];
          for (const [key, value] of Object.entries(v)) {
            if (value !== void 0) {
              infoLines.push(`${indent}│ ${key}: ${value}`);
            }
          }
        }
      }

      if (i === 0) {
        lines.push(`  ${ctx.name}${inlineInfo}`);
      } else {
        const indent = '  '.repeat(i);
        lines.push(`${indent}└─ ${ctx.name}${inlineInfo}`);
      }
      if (infoLines) {
        lines.push(...infoLines);
      }
    }

    let error = details.error;
    let disposeError;
    if (error instanceof SuppressedError) {
      disposeError = error.error;
      error = error.suppressed;
    }
    if (error instanceof ExecError) {
      lines.push(`${this._p.bold(error.name)}: ${error.message} (exit code: ${error.exitCode})`);
      lines.push(`CMD: ${error.cmd.map((s) => $_(s.replace('\n', '\\n'))).join(' ')}`);
      let closeRow = false;
      const cols = this._tuiColumns();
      if (error.stderr) {
        closeRow = true;
        lines.push(this._p.bold('=[ STDERR ]' + '='.repeat(cols - 11)));
        for (const line of error.stderr.trim().split('\n')) {
          lines.push(`${line}`);
        }
      }
      if (error.stdout) {
        closeRow = true;
        lines.push(this._p.bold('=[ STDOUT ]' + '='.repeat(cols - 11)));
        for (const line of error.stdout.trim().split('\n')) {
          lines.push(`${line}`);
        }
      }
      if (closeRow) {
        lines.push(this._p.bold('='.repeat(cols)));
      }
    } else if (error instanceof Error) {
      lines.push(`${this._p.bold(error.name)}: ${error.message}`);
    } else {
      lines.push(String(error));
    }
    if (disposeError) {
      lines.push(disposeError);
    }

    return lines;
  }
}

/** Buffered output entry accumulated during context execution. */
type OutputEntry =
  | { type: 'info'; message: string }
  | { type: 'warn'; message: string }
  | { type: 'error'; message: string }
  | { type: 'change'; entry: ChangeEntry }
  | { type: 'exception'; error: any };

/** Internal tracking state for an execution context. */
interface ContextDetails {
  readonly parent: ContextDetails | undefined;
  readonly ctx: ExecutionContext;
  readonly prefix: string;
  readonly depth: number;
  readonly startTime: number;
  readonly outputs: OutputEntry[];
  error: any;
}

/** One stable footer slot (a concurrent branch with its deepest visible task). */
interface TuiGroup {
  key: ExecutionContext;
  startTime: number;
  deepest: ExecutionContext;
  depth: number;
  prefix: string;
}

interface Palette {
  bold(text: string): string;
  dim(text: string): string;
  red(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
  cyan(text: string): string;
  cyanBold(text: string): string;
}

function _createPalette(useColor: boolean): Palette {
  if (useColor) {
    return {
      bold: (text: string) => `\x1b[1m${text}\x1b[22m`,
      dim: (text: string) => `\x1b[2m${text}\x1b[22m`,
      red: (text: string) => `\x1b[31m${text}\x1b[39m`,
      green: (text: string) => `\x1b[32m${text}\x1b[39m`,
      yellow: (text: string) => `\x1b[33m${text}\x1b[39m`,
      cyan: (text: string) => `\x1b[36m${text}\x1b[39m`,
      cyanBold: (text: string) => `\x1b[1;36m${text}\x1b[22;39m`,
    };
  }
  const t = (text: string) => text;
  return {
    bold: t,
    dim: t,
    red: t,
    green: t,
    yellow: t,
    cyan: t,
    cyanBold: t,
  };
}
