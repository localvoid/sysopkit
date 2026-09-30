---
title: Execution Model
description: How SysopKit propagates context, manages tasks, and handles execution lifecycle.
---

SysopKit propagates an `ExecutionContext` tree across async boundaries with `AsyncLocalStorage`. Every execution runs within a context that carries a reporter, connector, abort signal, typed variables, verbosity level, and dry-run flag.

## Context Tree

Contexts form a child-parent chain:

```
root ⇐ connector ⇐ [middleware] ⇐ task / utility ⇐ …
```

Each context inherits from its parent:

- **Reporter** — Shared across the tree for unified output
- **Connector** — The transport layer for command execution
- **AbortSignal** — Composed with parent signals for cascading cancellation
- **Vars** — Typed context variables with parent-chain lookup
- **Dry-run flag**

## Context Constructors

- **`start()`** creates a root context
- **`apply()`** creates connector contexts for each target host
- **`task()`** and **`utility()`** create child contexts for basic operations
- **`middleware()`** wraps the connector and creates a middleware context

## Context Lifecycle

- Each context calls `reporter.ctxStart()` on entry and `reporter.ctxEnd()` on exit
- On error, `reporter.ctxError()` is called and `AbortController` is triggered

## Logging: use the reporter, not `console`

Inside `start()` (anywhere an ambient context exists), never use `console.log/warn/error`. Take the `ctx` callback param instead:

```ts
await start(async (ctx) => {
  ctx.info('nginx installed');
  ctx.warn('legacy config detected');
  ctx.error(`failed on ${name}: ${err}`);
});
```

`task`, `utility`, and `apply` callbacks receive `ctx` the same way — prefer the param; reach for `context()` only in helpers that can't take it.

`ctx.info/warn/error` buffer per context and flush on completion with the hierarchical prefix, respect verbosity filtering, route info to stdout vs warn/error to stderr, cooperate with the live TUI footer, and honor custom `Reporter` implementations passed to `start({ reporter })`. Raw `console.*` bypasses all of that.

`console.*` is only appropriate outside `start()` (e.g. handling the `StartResult` after `start()` returns), where no context exists.

## Task vs Utility

|               | Task                                | Utility                            |
| ------------- | ----------------------------------- | ---------------------------------- |
| **Purpose**   | User-facing operations              | Internal helpers                   |
| **Verbosity** | Normal (configurable)               | Debug                              |
| **Examples**  | Installing packages, managing files | Retries, timeouts, event listeners |

```ts
import { task, utility } from 'sysopkit';

await task('install nginx', async () => {
  await sh('apt install -y nginx');
});

await utility('check state', async () => {
  // debug-level logging, not shown at normal verbosity
});
```

## Accessing Context

Call `context()` to retrieve the current context from `AsyncLocalStorage`:

```ts
import { context } from 'sysopkit';

const ctx = context();
const isDryRun: boolean = ctx.dryRun; // is this a dry run?
const taskName: string = ctx.name; // current task/utility name
```

Alternatively, receive the context as the closure argument of `task`, `utility`, or `apply`:

```ts
import { context } from 'sysopkit';

await task('install nginx', async (ctx) => {
  if (!ctx.dryRun) {
    await sh('apt install -y nginx');
  }
});
```
