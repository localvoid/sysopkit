---
title: Events and Changes
description: Type-safe event system and change tracking for infrastructure modifications.
---

SysopKit uses a type-safe event system with branded symbols to prevent accidental collisions.

## Event Type

```typescript
type Event<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.event';
};
```

## Emitting Events

Use `emit()` to dispatch events from any context:

```typescript
import { emit, Event, task } from 'sysopkit';

const MY_EVENT: Event<string> = Symbol('my.event');

await task('demo', async () => {
  emit(MY_EVENT, 'hello');
});
```

Events propagate up the parent context chain, calling registered handlers at each level.

## Listening for Events

Register handlers with `ctx.on()`:

```typescript
import { task } from 'sysopkit';

await task('demo', async (ctx) => {
  ctx.on(MY_EVENT, (data) => {
    console.log('received:', data);
  });

  await task('subtask', async () => {
    emit(MY_EVENT, 'hello from subtask');
  });
});
```

## Change Events

The `CHANGE_EVENT` carries `ChangeEntry` objects describing infrastructure modifications:

```typescript
interface ChangeEntry {
  type: string; // e.g., "file", "user", "package"
  resource: string; // e.g., "/etc/nginx/nginx.conf"
  property?: string; // e.g., "mode", "content"
  from?: string; // previous value (omitted on create)
  to?: string; // new value (omitted on delete)
}
```

## emitChanged()

A convenience function for operations to report changes:

```typescript
import { emitChanged } from 'sysopkit';

emitChanged({
  type: 'file',
  resource: '/etc/foo.conf',
  property: 'content',
  from: 'old',
  to: 'new',
});
```

## onChange()

Use `onChange()` to register a scoped change listener for the duration of a function:

```typescript
import { onChange, latch } from 'sysopkit';

const restart = latch();
await onChange(restart, async () => {
  await createFile({ path: '/etc/foo.conf', content: 'bar' });
});

if (restart()) {
  // restart service since configuration changed
}
```

The `latch()` utility returns a function that flips to `true` when a change is detected.
