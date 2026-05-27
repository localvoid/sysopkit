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

/** Configuration options for ConsoleReporter. */
export interface ConsoleReporterOptions {
  readonly color?: boolean;
  readonly verbosity: Verbosity;
}

/**
 * Reporter that writes formatted output to the terminal.
 *
 * Displays hierarchical context information with timing, color-coded status
 * indicators, and buffered output that prints on context completion.
 */
export class ConsoleReporter implements Reporter {
  /** Minimum verbosity level for output. */
  readonly verbosity: Verbosity;
  private readonly useColor: boolean;
  private readonly details: WeakMap<ExecutionContext, ContextDetails>;
  private readonly errorContexts: WeakMap<any, ContextDetails>;
  private readonly displayedErrors: WeakSet<any>;
  private _p: Palette;

  constructor(options?: ConsoleReporterOptions) {
    this.useColor = options?.color ?? process.stdout.isTTY ?? false;
    this.verbosity = options?.verbosity ?? 1;
    this.details = new WeakMap();
    this.errorContexts = new WeakMap();
    this.displayedErrors = new WeakSet();
    this._p = _createPalette(this.useColor);
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

    this.details.set(ctx, {
      parent,
      ctx,
      prefix: this._getDisplayPrefix(ctx),
      depth,
      startTime: Date.now(),
      outputs: [],
      error: void 0,
    });
  }

  /** Finalizes a context, printing status and buffered output if verbosity allows. */
  ctxEnd(ctx: ExecutionContext): void {
    const details = this.details.get(ctx);
    if (details === void 0) {
      throw new Error('invalid reporter state: context should be registered');
    }

    if (this.verbosity < ctx.verbosity) {
      const parent = details.parent;
      if (parent !== void 0) {
        parent.outputs.push(...details.outputs);
      }
      return;
    }

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
    console.log(message);
  }

  private _stderr(message: string): void {
    console.error(message);
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
      const cols = process.stdout.columns || 80;
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
