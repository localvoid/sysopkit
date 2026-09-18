# Utilities and errors

```typescript
import { retry, timeout, sleep, TimeoutError, AbortError, isAbortError } from 'sysopkit';
import { exec } from 'sysopkit/op/exec';
import { sh, ShellError } from 'sysopkit/op/sh';
```

## retry

```typescript
import { retry } from 'sysopkit';
await retry({ attempts: 3, delay?: 1000, backoff?: 'fixed' | 'exponential',
  maxDelay?, retryOn?: (err) => boolean },
  () => sh('curl -sf http://api/health'));
```

- Semantics: 1 initial call + up to `attempts` retries (`attempt <= attempts`).
- Never retries `AbortError` (cancellation propagates immediately); `retryOn`
  gates which other errors retry. Reports each attempt via
  `reporter.retryAttempt`, waits with abort-aware `sleep`.
- Exponential delay is `base * 2^attempt` (`2x` on the first retry, not `1x`),
  capped by `maxDelay`. Default `delay` is 1000 ms; default `backoff` is fixed.
- Wrapped in `utility('retry')` — invisible below `debug` verbosity.

## timeout

```typescript
import { timeout } from 'sysopkit';
await timeout(30_000, () => sh('long-migration')); // exceeded → TimeoutError
```

Creates a local `AbortController` on a timer and runs `fn` in a `utility`
whose signal combines it with the parent. On expiry the controller aborts with
`TimeoutError`, so what surfaces is the abort `signal.reason` wherever the op
checks cancellation — not necessarily a thrown `TimeoutError` at your call
site. Always clears the timer in `finally`. Outer abort also fires the inner
signal (merged, not linked one-way).

## sleep

```typescript
import { sleep } from 'sysopkit';
await sleep(5000); // rejects with signal.reason on cancellation
```

Requires ambient context (throws outside `start()`). Checks
`signal.throwIfAborted()` upfront, removes its abort listener after firing.
Use for polling loops instead of `Bun.sleep` so cancellation propagates.

## Error hierarchy

| Error | Meaning | Carries |
| --- | --- | --- |
| `OperationError` | Op-level failure | `cause` chain |
| `ConnectorError` | Transport failure (connect/spawn/dispose) | `conn` |
| `ExecError` / `ShellError` | Non-zero exit | `cmd`, `exitCode`, `stdout`, `stderr` |
| `AbortError` | Cancellation via signal or `ctx.abort()` | — |
| `TimeoutError` | `timeout()` exceeded | — |
| `ApplyError` | Multi-host failure; extends `AggregateError` | per-host `results` |

- `start()` catches everything into `{ success: false, error }` — narrow with
  `instanceof` / `isAbortError(err)` (name-based, realm-safe).
- `retry` + `timeout` composition: expiry aborts with `TimeoutError` as the
  signal reason, which surfaces wherever the op checks cancellation (e.g.
  `sleep` rejects with it). `retry` only skips `AbortError`, so a `TimeoutError`
  **is retried** by default. Put `timeout` inside `retry` for per-attempt
  timeouts, or pass `retryOn: (e) => !(e instanceof TimeoutError)` /
  filter by name to stop after the first timeout.
- `ctx.abort(reason?)` reports and throws `AbortError` — prefer it over throwing
  raw errors when user code decides to cancel.
- `ShellError.stdout/stderr` are decoded strings even when the op ran with
  `'buffer'` output.
