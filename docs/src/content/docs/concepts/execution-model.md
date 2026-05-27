---
title: Execution Model
description: How SysopKit propagates context, manages tasks, and handles execution lifecycle.
---

SysopKit uses `AsyncLocalStorage` to propagate `ExecutionContext` tree across async boundaries. Every execution runs within a context that carries a reporter, connector, abort signal, typed variables, verbosity level and dry-run flag.

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

Context can be accessed either via `context()` function to retrieve it from `AsyncLocalStorage`:

```ts
import { context } from 'sysopkit';

const ctx = context();
console.log(ctx.dryRun); // is this a dry run?
console.log(ctx.name); // current task/utility name
```

Or from `apply`, `task`, `utility` closures:

```ts
import { context } from 'sysopkit';

await task('install nginx', async (ctx) => {
  if (!ctx.dryRun) {
    await sh('apt install -y nginx');
  }
});
```
