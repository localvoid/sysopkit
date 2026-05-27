/**
 * @module systemd/journal
 *
 * systemd journal operations.
 *
 * @see journalctl(1) - Query the systemd journal
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

/**
 * Options for vacuuming the journal.
 */
export interface JournalVacuumOptions {
  /** Maximum disk space to use (e.g., "100M", "1G"). */
  readonly size?: string;
  /** Maximum age of entries to keep (e.g., "7d", "1month"). */
  readonly time?: string;
  /** Maximum number of journal files to keep. */
  readonly files?: number;
}

/**
 * Vacuum (clean up) the journal.
 *
 * Removes old journal entries based on size, time, or file count limits. At least one option must
 * be specified.
 */
export async function journalVacuum(options: JournalVacuumOptions): Promise<void> {
  const { size, time, files } = options;

  return task(
    'journal vacuum',
    async () => {
      const args = [];

      if (size !== void 0) args.push(`--vacuum-size=${size}`);
      if (time !== void 0) args.push(`--vacuum-time=${time}`);
      if (files !== void 0) args.push(`--vacuum-files=${files}`);
      if (args.length === 0) {
        return;
      }

      await sh(`journalctl ${args.map($_).join(' ')}`);
      emitChanged({ type: 'systemd', resource: 'journal', property: 'vacuumed' });
    },
    { verbosity: VERBOSITY_TRACE },
  );
}

/**
 * Options for reading journal entries.
 */
export interface JournalRead {
  /** Cursor position to start reading from. */
  readonly afterCursor?: string;
  /** Maximum number of entries to return. */
  readonly lines?: number;
}

/**
 * Read journal entries
 *
 * Returns entries after the specified cursor, useful for incremental journal reading.
 */
export async function journalRead(options: JournalRead): Promise<string> {
  const { afterCursor, lines } = options;

  const args = [];

  if (afterCursor !== void 0) args.push(`--after-cursor=${afterCursor}`);
  if (lines !== void 0) args.push(`--lines=${lines}`);

  const { stdout } = await sh(`journalctl ${args.map($_).join(' ')} --show-cursor`);
  return stdout;
}
