---
title: Dry Run and Verbosity
description: Controlling execution mode and output verbosity.
---

## Dry Run Mode

Dry run mode prevents actual changes while still showing what would happen. The flag is global (set once at `start()`, inherited down the context tree) but enforcement is per-op: idempotent operations emit change events but skip modification. Exceptions: `tar`/`untar` emit unconditionally, and `curl` has no dry-run guard.

Enable dry-run mode via the environment variable:

```sh
SYSOPKIT_DRY_RUN=1 bun run script.ts
```

Alternatively, enable it programmatically:

```ts
await start(
  async (ctx) => {
    // idempotent ops will emit changes but not execute
    await createFile({ path, content });

    // manual check for non-idempotent operations
    if (!ctx.dryRun) {
      await sh('destructive-command');
    }
  },
  { dryRun: true },
);
```

## Verbosity Levels

| Level | Constant            | Usage                       |
| ----- | ------------------- | --------------------------- |
| 0     | `VERBOSITY_MINIMAL` | Suppress most output        |
| 1     | `VERBOSITY_NORMAL`  | Default task visibility     |
| 2     | `VERBOSITY_TRACE`   | Include trace-level details |
| 3     | `VERBOSITY_DEBUG`   | Full debug output           |

Set via environment variable:

```sh
SYSOPKIT_VERBOSITY=debug bun run script.ts
```

The valid values are `minimal`, `normal`, `trace`, and `debug`.

Invalid values produce a warning and fall back to `normal`.

## TUI

On an interactive terminal (`stderr` is a TTY), `ConsoleReporter` shows a live footer at the bottom with one line per concurrent branch (e.g. one line per host in multi-host `apply`). Deeper tasks reuse their branch slot, so each host stays at a stable position while its stack grows:

```text
⠋ deploy › host1 › install › write file (3s)
⠋ deploy › host2 › install (2s)
```

The footer is enabled automatically on TTYs and disabled when piped. Control it via the `tui` option (`true` forces on, `false` forces off, `'auto'` detects). The standard `TERM=dumb` variable disables auto mode:

```sh
TERM=dumb bun run script.ts  # disable the footer
```
