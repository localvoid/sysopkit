# Execution model

Every op runs inside an `ExecutionContext` propagated by `AsyncLocalStorage`. Frames form a parent chain and inherit the reporter, connector, abort signal (composed with the parent via `AbortSignal.any`), typed vars, and dry-run flag:

```text
root → apply → connector → [middleware …] → task / utility
```

`context()` outside a frame throws `No context available` — check for a missing `start()`/`main()` first.

## Open the root frame

```typescript
import { main } from 'sysopkit/start';

await main(fn, { reporter?, dryRun?, signal?, vars? });
```

- `start()` creates the root context, enters the ALS scope, and runs `fn`. It never throws: it returns `{ success: true, result, duration }` or `{ success: false, error, duration }`.
- `main()` is the CLI entry point: same result, plus `process.exitCode` (`1` on failure, `0` on success when unset). At debug verbosity it also rethrows the failure after setting the exit code. It never calls `process.exit()`, so reporter output and `await using` cleanup finish.
- `dryRun` defaults to the `SYSOPKIT_DRY_RUN` env var.
- Verbosity comes from `SYSOPKIT_VERBOSITY`: `minimal` (0), `normal` (1, default), `trace` (2), `debug` (3, includes utilities). Invalid values log to stderr.
- Registers a one-shot `SIGINT` handler that aborts the run.

## Choose a child frame

| Frame | Verbosity | Use |
| --- | --- | --- |
| `task(name, fn, opts?)` | `NORMAL` | User-facing step; `details?` adds metadata. |
| `utility(name, fn, opts?)` | `DEBUG` | Internal helper. `retry`, `timeout`, and `onChange` wrap themselves in one. |
| `middleware(name, fn, wrap)` | `DEBUG` | Swaps the connector for the scope of `fn`. Throws when the parent has no connector. |

```typescript
import { task, utility } from 'sysopkit';

await task('install nginx', async () => { … }, { details?, verbosity?, vars?, signal? });
await utility('probe', async () => { … }, { vars?, signal? });
```

Each frame calls `reporter.ctxStart` on entry and `reporter.ctxEnd` on exit; on error it calls `reporter.ctxError` and aborts that frame's controller. **A frame aborts its own controller when it completes**, so a child `ctx.signal` is dead after `fn` returns; capture the parent's signal instead.

## Report through `ctx`

Inside any frame, take the callback parameter instead of using `console`:

```typescript
import { start } from 'sysopkit/start';

await start(async (ctx) => {
  ctx.info('nginx installed');
  ctx.warn('legacy config detected');
  ctx.error(`failed on ${name}: ${err}`);
});
```

`task`, `utility`, and `apply` callbacks receive `ctx` the same way. Reach for `context()` only in helpers that cannot take the parameter.

`ctx.info/warn/error` buffer per frame, flush on `ctxEnd` with the hierarchical prefix, respect verbosity filtering, route info → stdout and warn/error → stderr, cooperate with the live TUI footer, and honor a custom `Reporter`. Raw `console.*` bypasses all of that — no prefix, wrong ordering against status lines, a corrupted footer, and ignored reporters. Use `console.*` only outside a frame, e.g. while handling the `StartResult`.

`ConsoleReporter` details:

- Hierarchy renders with `›` separators (`root › web1 › sudo › install nginx`).
- `ctxEnd` is suppressed when `reporter.verbosity < ctx.verbosity`, and buffered output bubbles to the parent. `spawn` logging appears only at `debug`.
- Root frames never print a status line; repeated error renders are deduped when buffered output flushes.
- A context is bound to one reporter instance. Reusing a context subtree under a different reporter throws `invalid reporter state`.

## Dry-run

`dryRun` is set once at `start()` and inherited down the tree; no level overrides it. There is **no central enforcement** — each op branches itself:

```typescript
import { context } from 'sysopkit';

if (!context().dryRun) {
  /* mutating work */
}
// idempotent ops still emitChanged() so --dry-run shows what WOULD change
```

- Idempotent ops (`createFile`, `createUser`, …) check state, emit changes, and skip mutation.
- `rsync` appends `--dry-run`; package ops compare installed snapshots and emit the diff without running the solver.
- `curl` with `path` skips the download in dry-run (it still emits the change); stdout mode fetches regardless.
- Bare primitives (`exec`, `sh`) and read-only probes run even in dry-run.

## Rules

- `TaskOptions.vars` is typed `Record<string, any>`, so a symbol-keyed `Var<T>` needs a cast; runtime lookup still accepts symbols. `utility`, `apply`, and `start` are typed `Record<string | symbol, any>`.
- `Vars` lookup walks the parent chain. `get()` throws on a missing key, so an explicit `undefined` is indistinguishable from absent.
- `task`, `utility`, `middleware`, `apply`, `emit`, `retry`, `timeout`, and `sleep` all need the ambient frame. Call them inside `start()`.
