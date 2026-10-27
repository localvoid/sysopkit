# Other middleware: trace, expect, transform-cmd

```typescript
import { middleware, ConnectorMiddleware } from 'sysopkit';
```

`middleware()` creates a `DEBUG`-verbosity child frame whose connector is `wrap(parent.conn, parent)`. Layers stack by nesting; execution order follows it (`sudo → trace → connector` means sudo wraps trace wraps the raw connector).

```typescript
abstract class ConnectorMiddleware implements Connector {
  constructor(public readonly next: Connector);
}
function middleware<R>(name, fn, wrap: (next, ctx) => Connector, options?: { info? }): Promise<R>;
function updateConnectorOptions<R>(fn: (conn: Connector) => R): R;
```

`updateConnectorOptions()` unwraps to the base connector and invokes `fn`; narrow with `instanceof`. It sees the current connector only, so it fits single-connector flows.

For `sudo`, see [sudo](sudo.md). For `chroot`, see [chroot](chroot.md).

## trace

```typescript
import { trace } from 'sysopkit/middleware/trace';

await trace(async () => { /* stdout/stderr reported via reporter */ },
  { stdout?: true, stderr?: true, on?: (type, content) => void });
```

Pipes both streams through `TransformStream`s. Bytes pass through untouched; decoded text is buffered and reported on stream close via `ctx.reporter.info/error`, plus the optional `on` callback. Empty or whitespace-only output is suppressed. Chunk boundaries are joined with a space, which can insert artifacts into streamed text.

Reports fire **only on stream close**, so long-running processes show nothing until exit. When stacked with sudo or expect, nesting order decides which layer sees raw vs transformed streams.

## expectStderrPrompt

```typescript
import { expectStderrPrompt } from 'sysopkit/middleware/expect';

await expectStderrPrompt(
  async () => {
    /* answer a prompt */
  },
  { pattern: /passphrase/, response: 'secret\n' },
);
```

Watches **stderr only**, writes `response` verbatim (include `\n` yourself) to stdin on the **first** match, and strips the matched text from stderr. Chunk-split safe: the trailing window is `pattern.length - 1` for strings and 256 chars for RegExp; very long RegExp leading context can still miss.

Rules:

- One response per scope; a prompt that never appears leaves pending stdin writes unresolved until the signal aborts.
- Avoid the `g` flag: its stateful `lastIndex` breaks matching.
- The response is logged as `<hidden>`.

## TransformCmdMiddleware

```typescript
import { middleware } from 'sysopkit';
import { TransformCmdMiddleware } from 'sysopkit/middleware/transform-cmd';

await middleware(
  'prefix',
  fn,
  (next) => new TransformCmdMiddleware(next, (cmd) => ['nice', '-n', '10', ...cmd]),
);
```

Pure synchronous per-`spawn` rewrite (prefix, wrap, flag-inject). It has no `fn` wrapper — instantiate it inside `middleware()` directly. Return a **new** array and leave the input untouched. It has no access to ctx or signal. Layers compose by nesting order.
