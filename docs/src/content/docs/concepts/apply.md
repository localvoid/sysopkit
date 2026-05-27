---
title: Orchestrating Operations
description: Orchestrating operations across one or more hosts.
---

The `apply()` function orchestrates operations across target hosts. It handles connection management, context creation, and multi-host batching.

## Single-Host Mode

Connects to a single host, creates a connector context, and runs the function:

```ts
import { start } from 'sysopkit/start';
import { apply, LocalConnector } from 'sysopkit';
import { sh } from 'sysopkit/op/sh';

await start(async () => {
  await using c = new LocalConnector();

  const result = await apply('setup', c, async () => {
    await sh('hostname');
    return 'done';
  });
  // result: { success: true, conn: c, result: 'done' }
});
```

## Multi-Host Mode

Processes multiple hosts in parallel batches:

```ts
import { start, resolveInventory, apply } from 'sysopkit';

const inventory = {
  groups: {
    web: {
      hosts: {
        'web-1': { host: '10.0.1.1' },
        'web-2': { host: '10.0.1.2' },
        'web-3': { host: '10.0.1.3' },
      },
    },
  },
};

await start(async () => {
  await using hosts = resolveInventory(inventory);

  const results = await apply(
    'setup web',
    hosts.getByGroup('web'),
    async () => {
      await sh('hostname');
    },
    { batchSize: 2, maxFailPercent: 20 },
  );
  // results: ApplyResult<void>[]
});
```

## Options

| Option           | Default | Description                                                 |
| ---------------- | ------- | ----------------------------------------------------------- |
| `batchSize`      | 5       | Number of hosts to process in parallel                      |
| `maxFailPercent` | —       | Abort remaining batches if failure % exceeds this threshold |
| `vars`           | —       | Additional context variables                                |

## Error Handling

In multi-host mode, failures are collected per-host. If `maxFailPercent` is exceeded, `apply()` throws `ApplyError` (extends `AggregateError`) containing all per-host results:

```ts
import { ApplyError } from 'sysopkit';

try {
  await apply('setup', hosts.getAll(), fn, { maxFailPercent: 20 });
} catch (err) {
  if (err instanceof ApplyError) {
    for (const result of err.results) {
      if (!result.success) {
        console.error(`${result.conn.name} failed:`, result.error);
      }
    }
  }
}
```
