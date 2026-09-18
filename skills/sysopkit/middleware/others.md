# Other middleware: trace, expect, transform-cmd

```typescript
import { middleware, ConnectorMiddleware } from 'sysopkit';
import { trace } from 'sysopkit/middleware/trace';
import { expectStderrPrompt } from 'sysopkit/middleware/expect';
import { TransformCmdMiddleware } from 'sysopkit/middleware/transform-cmd';
```

For `sudo`, see [sudo](sudo.md).

## Model

```typescript
abstract class ConnectorMiddleware implements Connector { constructor(protected readonly next: Connector) }
function middleware<R>(name, fn, wrap: (next, ctx) => Connector, options?: { info? }): Promise<R>;
```

`middleware()` creates a `DEBUG`-verbosity child context whose connector is
`wrap(parent.conn, parent)`. Layers stack by nesting; execution order follows
nesting order (`sudo → trace → connector` means sudo wraps trace wraps the raw
connector).

## trace (`sysopkit/middleware/trace`)

```typescript
import { trace } from 'sysopkit/middleware/trace';
await trace(async () => { /* stdout/stderr reported via reporter */ },
  { stdout?: true, stderr?: true, on?: (type, content) => void });
```

Pipes both streams through `TransformStream`s; bytes pass through untouched,
decoded text is buffered and reported on stream close via
`ctx.reporter.info/error`, plus the optional `on` callback.
Empty/whitespace-only output is suppressed. Chunk boundaries are joined with a
space (can insert artifacts into streamed text).

**Pitfall:** reports fire **only on stream close** — long-running processes show
nothing until exit. When stacked with sudo/expect, nesting order changes which
layer sees raw vs transformed streams.

## expectStderrPrompt (`sysopkit/middleware/expect`)

```typescript
import { expectStderrPrompt } from 'sysopkit/middleware/expect';
await expectStderrPrompt(async () => { /* answer a prompt */ },
  { pattern: /passphrase/, response: 'secret\n' });
```

Watches **stderr only**, writes `response` verbatim (include `\n` yourself) to
stdin on the **first** match, strips the matched text from stderr. Chunk-split
safe (trailing window: `pattern.length - 1` for strings, 256 chars for
RegExp); very long RegExp leading context can still miss.

**Pitfalls:** fires **once**; avoid the `g` flag (stateful `lastIndex` breaks
matching); response is logged as `<hidden>`; if the prompt never appears,
pending stdin writes never resolve — the scope hangs until its signal aborts.

## TransformCmdMiddleware (`sysopkit/middleware/transform-cmd`)

```typescript
import { middleware } from 'sysopkit';
import { TransformCmdMiddleware } from 'sysopkit/middleware/transform-cmd';

await middleware('prefix', fn, (next) => new TransformCmdMiddleware(next,
  (cmd) => ['nice', '-n', '10', ...cmd]));
```

Pure sync per-`spawn` rewrite (prefix/wrap/flag-inject). No `fn` wrapper —
instantiate inside `middleware()` directly. Return a **new** array, never
mutate the input. No access to ctx/signal. Composes by nesting order.
