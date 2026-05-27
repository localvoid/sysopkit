---
title: Core Functions
description: Reference for start, task, utility, context, emit, onChange, latch, and middleware.
---

## start()

Entry point for all SysopKit scripts. Creates a root execution context, sets up a reporter and abort handling, and runs the provided function.

```ts
import { start } from 'sysopkit/start';
```

```ts
async function start<R>(fn: () => Promise<R>, options?: StartOptions): Promise<StartResult<R>>;
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `reporter` | `Reporter` | `ConsoleReporter` | Custom reporter for output |
| `dryRun` | `boolean` | `SYSOPKIT_DRY_RUN` env var | Prevent actual changes |
| `signal` | `AbortSignal` | — | External signal for cancellation |
| `vars` | `Record<symbol \| string, any>` | — | Initial context variables |

### Return Value

```ts
type StartResult<T> =
  | { success: true; result: T; duration: number }
  | { success: false; error: unknown; duration: number };
```

Always returns a result — never throws. Check `result.success` to determine outcome.

---

## task()

Creates a named child context for a user-facing operation. Task output appears at normal verbosity.

```ts
import { task } from 'sysopkit';
```

```ts
async function task<R>(
  name: string,
  fn: (ctx: ExecutionContext) => Promise<R>,
  opts?: TaskOptions,
): Promise<R>;
```

### Options

| Option      | Type                                 | Description                          |
| ----------- | ------------------------------------ | ------------------------------------ |
| `details`   | `string \| (() => string \| Record)` | Additional context info for reporter |
| `verbosity` | `Verbosity`                          | Override verbosity for this task     |
| `vars`      | `Record<string, any>`                | Scoped context variables             |
| `signal`    | `AbortSignal`                        | Scoped abort signal                  |

---

## utility()

Creates a named child context for internal helper operations. Output is suppressed at normal verbosity (shown at debug level).

```ts
import { utility } from 'sysopkit';
```

```ts
async function utility<R>(
  name: string,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: UtilityOptions,
): Promise<R>;
```

### Options

| Option   | Type                            | Description              |
| -------- | ------------------------------- | ------------------------ |
| `vars`   | `Record<symbol \| string, any>` | Scoped context variables |
| `signal` | `AbortSignal`                   | Scoped abort signal      |

---

## context()

Returns the current `ExecutionContext`. Throws if called outside a `start()` scope.

```ts
import { context } from 'sysopkit';
```

```ts
function context(): ExecutionContext;
```

### ExecutionContext Properties

| Property | Type | Description |
| --- | --- | --- |
| `type` | `ContextType` | `'root'` \| `'apply'` \| `'connector'` \| `'middleware'` \| `'utility'` \| `'task'` |
| `parent` | `ExecutionContext \| null` | Parent context in the tree |
| `reporter` | `Reporter` | Shared reporter instance |
| `conn` | `Connector \| null` | Active connector (null in root) |
| `dryRun` | `boolean` | Dry-run mode flag |
| `name` | `string` | Context name |
| `vars` | `Record<symbol \| string, any>` | Context variables |
| `signal` | `AbortSignal` | Abort signal for cancellation |
| `verbosity` | `Verbosity` | Current verbosity level |

### Methods

| Method               | Description                                        |
| -------------------- | -------------------------------------------------- |
| `tryGet(key)`        | Get variable by key, returns `undefined` if absent |
| `get(key)`           | Get variable by key, throws if absent              |
| `abort(reason?)`     | Abort execution with optional reason               |
| `on(event, handler)` | Register event handler for this context            |
| `info(msg)`          | Log at info level                                  |
| `warn(msg)`          | Log at warning level                               |
| `error(msg)`         | Log at error level                                 |

---

## emit()

Dispatches an event that propagates up the context chain. Registered handlers at each level are called.

```ts
import { emit } from 'sysopkit';
```

```ts
function emit<T>(event: Event<T>, data: T): void;
```

---

## emitChanged()

Convenience function for operations to report infrastructure modifications. Emits a `CHANGE_EVENT` with the provided entry or entries.

```ts
import { emitChanged } from 'sysopkit';
```

```ts
function emitChanged(entries: ChangeEntry | ChangeEntry[]): void;
```

---

## onChange()

Registers a change listener for the duration of a function. The handler is called whenever a `CHANGE_EVENT` is emitted within the scope.

```ts
import { onChange } from 'sysopkit';
```

```ts
async function onChange<R>(
  handler: (event: ChangeEntry | ChangeEntry[]) => void,
  fn: () => R | Promise<R>,
): Promise<R>;
```

---

## latch()

Returns a closure that starts `false` and flips to `true` on the first truthy call. Used with `onChange()` to detect whether changes occurred.

```ts
import { latch } from 'sysopkit';
```

```ts
function latch<T>(): (value?: T) => boolean;
```

```ts
const changed = latch();

// onChange will call changed(true) on any change
await onChange(changed, async () => {
  await createFile({ path: '/etc/conf', content: 'data' });
});

if (changed()) {
  // React to changes
}
```

---

## middleware()

Wraps a connector with middleware for the duration of a function. The middleware factory receives the current connector and context, and returns a new connector.

```ts
import { middleware } from 'sysopkit';
```

```ts
function middleware<R>(
  name: string,
  fn: (ctx: ExecutionContext) => Promise<R>,
  wrap: (next: Connector, ctx: ExecutionContext) => Connector,
  options?: MiddlewareContextOptions,
): Promise<R>;
```
