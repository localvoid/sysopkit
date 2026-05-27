---
title: Idempotency & Safety
description: How SysopKit ensures operations only apply changes when necessary.
---

A core design goal of SysopKit is that running the same script multiple times produces the same final state — without unnecessary side effects. This is achieved through idempotent operations and a change-tracking system.

## What is Idempotency?

An operation is idempotent if applying it multiple times has the same effect as applying it once. For example, creating a file with specific content is idempotent — the second run simply checks that content hasn't changed.

## Benefits

- **Safe re-runs**: Re-run failed scripts without worrying about duplicate changes
- **Predictable outcomes**: The same script always converges to the same state
- **Auditable changes**: Every modification is captured as a `ChangeEntry` event

## Change Detection

When an operation detects a difference and makes a change, it emits a `CHANGE_EVENT` via `emitChanged()`. This event propagates up the context chain, allowing parent scopes to react.

```typescript
import { emitChanged } from 'sysopkit';

// Inside an operation after detecting a diff
emitChanged({
  type: 'file',
  resource: '/etc/nginx/nginx.conf',
  property: 'content',
  to: 'server { listen 80; }',
});
```

## Reacting to Changes

Use `onChange()` with `latch()` to conditionally run follow-up actions only when something actually changed:

```typescript
import { onChange, latch } from 'sysopkit';

const restart = latch();

await onChange(restart, async () => {
  await createFile({ path: '/etc/service.conf', content: 'new config' });
});

if (restart()) {
  // Only runs if createFile actually changed something
  await sh('systemctl restart myservice');
}
```

## Non-idempotent Operations

Some commands are inherently non-idempotent — sending a notification, appending to a log, or running a one-time migration. For these, use `ctx.dryRun` to guard execution:

```typescript
import { context } from 'sysopkit';

if (!ctx.dryRun) {
  await sh('notify-admin "Deployment complete"');
}
```

## Dry Run

Set `dryRun: true` in `start()` options or `SYSOPKIT_DRY_RUN=1` environment variable. Idempotent operations will emit change events (showing what _would_ happen) but skip actual modifications.
