---
title: Dry Run and Verbosity
description: Controlling execution mode and output verbosity.
---

## Dry Run Mode

Dry run mode prevents actual changes while still showing what would happen. Idempotent operations emit change events but skip modification.

Enable via environment variable:

```sh
SYSOPKIT_DRY_RUN=1 bun run script.ts
```

Or programmatically:

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

Valid values: `minimal`, `normal`, `trace`, `debug`.

Invalid values produce a warning and fall back to `normal`.
