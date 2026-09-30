# Execution model

```typescript
import { start } from 'sysopkit/start';
import { task, utility, context, middleware } from 'sysopkit';
```

## Context tree

Every operation runs inside an `ExecutionContext` propagated via `AsyncLocalStorage`. Contexts form a parent chain:

```text
root → apply → connector → [middleware …] → task / utility
```

Each child inherits: `reporter`, `connector`, `AbortSignal` (composed with the parent via `AbortSignal.any`), typed `Vars`, and the `dryRun` flag. `context()` throws `No context available` outside `start()` — this is the most common beginner error.

## Entry point

```typescript
import { main } from 'sysopkit/start';

await main(fn, { reporter?, dryRun?, signal?, vars? });
```

- Creates the root context, enters the ALS scope via `runWithContext()`, runs `fn`.
- `main()` is the CLI script entry point: sets `process.exitCode` (`1` on failure, `0` on success when unset) and returns `{ success: true, result, duration }` or `{ success: false, error, duration }`. At debug verbosity it rethrows the failure after setting the exit code. Use `start()` instead when you need to handle the result yourself — it never throws and never touches the exit code.
- `dryRun` defaults to the `SYSOPKIT_DRY_RUN` env var.
- Verbosity comes from `SYSOPKIT_VERBOSITY`: `minimal` (0), `normal` (1, default), `trace` (2), `debug` (3, includes utilities). Invalid values log to stderr.
- Registers a one-shot `SIGINT` handler that aborts the run.

## task vs utility vs middleware

```typescript
import { task, utility } from 'sysopkit';

await task('install nginx', async () => { … }, { details?, verbosity?, vars?, signal? });
await utility('probe', async () => { … }, { vars?, signal? });
```

- `task(name, fn, opts?)` — user-facing step. Default verbosity `NORMAL`, so it shows at default output. Optional `details` metadata.
- `utility(name, fn, opts?)` — internal helper. Fixed verbosity `DEBUG`, hidden unless `SYSOPKIT_VERBOSITY=debug`. `retry`, `timeout`, `onChange` all wrap themselves in `utility`.
- `middleware(name, fn, wrap)` — swaps the connector for the scope of `fn` (see `middleware/sudo.md` and `middleware/others.md`). Throws if the parent context has no connector.

Each frame calls `reporter.ctxStart` on entry, `reporter.ctxEnd` on exit, and on error `reporter.ctxError` plus abort of that frame's `AbortController`. A frame completing aborts its own controller — never capture a child `ctx.signal` and use it after `fn` returns; it will already be aborted.

## Reporter behavior (ConsoleReporter)

- Hierarchical display with `›` separators (`root › web1 › sudo › install nginx`).
- `ctxEnd` is suppressed when `reporter.verbosity < ctx.verbosity`, and buffered output bubbles to the parent. `spawn` logging only appears at `debug`.
- Root contexts never print a status line. Repeated renders of the same error are deduped when buffered output flushes.
- Contexts are bound to one reporter instance; reusing a context subtree under a different reporter throws `invalid reporter state`.

## Logging: use the reporter, not `console`

Inside `start()` (anywhere an ambient context exists), never use `console.log/warn/error`. Take the `ctx` callback param instead:

```typescript
import { start } from 'sysopkit/start';

await start(async (ctx) => {
  ctx.info('nginx installed');
  ctx.warn('legacy config detected');
  ctx.error(`failed on ${name}: ${err}`);
});
```

`task`, `utility`, and `apply` callbacks receive `ctx` the same way — prefer the param; reach for `context()` only in helpers that can't take it.

Why: `ctx.info/warn/error` buffer per context and flush on `ctxEnd` with the hierarchical prefix, respect verbosity filtering, route info → stdout vs warn/error → stderr, cooperate with the live TUI footer, and honor custom `Reporter` implementations passed to `start({ reporter })`. Raw `console.*` bypasses all of that — no prefix, wrong ordering vs task status lines, corrupts the TUI footer, and ignores custom reporters.

`console.*` is only appropriate outside `start()` (e.g. handling the `StartResult` after `start()` returns), where no context exists.

## Dry-run

`dryRun: boolean` is set once at `start()` and inherited down the whole tree; it is never overridden per-level. There is **no central enforcement** — each op branches itself:

```typescript
import { context } from 'sysopkit';
if (!context().dryRun) {
  /* mutating work */
}
// idempotent ops still emitChanged() so --dry-run shows what WOULD change
```

Consequences:

- Idempotent ops (`createFile`, `createUser`, …) check state, emit change events, but skip mutation.
- `rsync` appends `--dry-run`; package ops preview instead of mutating (apt `-s`, apk `--simulate`, dnf `--assumeno`, pacman `-p`).
- `curl` has **no** dry-run guard — it always downloads.
- Read-only probes (`exec`, `sh`, `stat`) intentionally run even in dry-run.

## Gotchas

- `TaskOptions.vars` is typed `Record<string, any>` — symbol-keyed `Var<T>`s are dropped there. Use `utility`, `apply`, or `start` `vars` for typed vars.
- `Vars` lookup walks the parent chain; `get()` throws on missing keys, so an explicit `undefined` value is indistinguishable from absent.
- All context helpers (`task`, `utility`, `middleware`, `apply`, `emit`, `retry`, `timeout`, `sleep`) require the ambient context. Call them only inside `start()`.
