# Utilities and errors

## retry

```typescript
import { retry } from 'sysopkit';
import { sh } from 'sysopkit/op/sh';

await retry(
  { attempts: 3, delay?: 1000, backoff?: 'fixed' | 'exponential',
    maxDelay?, retryOn?: (err) => boolean },
  () => sh('curl -sf http://api/health'),
);
```

- Runs one initial call plus up to `attempts` retries (`attempt <= attempts`).
- Never retries `AbortError`; cancellation propagates immediately. `retryOn` decides which other errors retry. Reports each attempt via `reporter.retryAttempt` and waits with abort-aware `sleep`.
- Exponential delay is `base * 2^attempt` (2× on the first retry, not 1×), capped by `maxDelay`. `delay` defaults to 1000 ms and `backoff` to `fixed`.
- Wrapped in `utility('retry')`, so it is invisible below `debug` verbosity.

## timeout

```typescript
import { timeout } from 'sysopkit';
import { sh } from 'sysopkit/op/sh';

await timeout(30_000, () => sh('long-migration')); // exceeded → TimeoutError
```

Creates a local `AbortController` on a timer and runs `fn` in a `utility` whose signal is merged with the parent. On expiry the controller aborts with `TimeoutError`, so the abort `signal.reason` surfaces wherever the op checks cancellation — not necessarily as a thrown `TimeoutError` at your call site. The timer is always cleared in `finally`. An outer abort also fires the inner signal (merged, not one-way).

## sleep

```typescript
import { sleep } from 'sysopkit';

await sleep(5000); // rejects with signal.reason on cancellation
```

Requires an ambient frame (throws outside `start()`). Checks `signal.throwIfAborted()` upfront and removes its abort listener after firing. Use it in polling loops instead of `Bun.sleep` so cancellation propagates.

## waitUntil

Poll a predicate until it holds. `false`, missing resources, and `retryOn`-matching throws are "not yet"; anything else propagates at once. Always fails closed at `timeoutMs`.

```typescript
import { waitUntil } from 'sysopkit';
import { tryReadFile } from 'sysopkit/op/file';

await waitUntil(async () => ((await tryReadFile(p)) ?? '').includes('ready'), {
  describe: `content in ${p}`,
  timeoutMs: 10 * 60_000,
});
```

- Defaults: `timeoutMs` 10 min, `intervalMs` 1 s, `retryOn` = `ConnectorError` + `ExecError`/`ShellError` (a down host reads as "not yet"). Pass `retryOn: () => false` to fail fast.
- Runs as `task('wait <describe>')`; `describe` also labels the `TimeoutError`, which carries the last probe error as `cause`.
- Probe with `|| exit 64` so absence shows as `exitCode`, not a throw: file presence via `getPathInfo`, content via `tryReadFile ?? ''`, ports via bash `/dev/tcp` or `nc -z -w 1`, processes via exact-name `pidof`.

## waitForReady

```typescript
import { waitForReady } from 'sysopkit';
import { SSHConnector } from 'sysopkit/connector/ssh';

await waitForReady(new SSHConnector({ host: '10.0.1.1' }),
  { timeoutMs?: 5 * 60_000, intervalMs?: 5_000, signal? });
```

Polls the connector's side-effect-free `isReady()` until true. Takes a live instance, not a factory. Runs its own `task()` frame, so validation failures report against it. Throws `TimeoutError` carrying host and budget; aborts propagate unchanged. Local is always ready; Podman checks `running`; SSH runs a multiplex-free `ssh <host> exit` probe.

## Error hierarchy

| Error | Meaning | Carries |
| --- | --- | --- |
| `OperationError` | Op-level failure | `cause` chain |
| `ConnectorError` | Transport failure (connect/spawn/dispose) | `conn` |
| `ExecError` / `ShellError` | Non-zero exit | `cmd`, `exitCode`, `stdout`, `stderr` |
| `AbortError` | Cancellation via signal or `ctx.abort()` | — |
| `TimeoutError` | `timeout()`/`waitUntil()` budget exceeded | optional `cause` |
| `ApplyError` | `apply()` failure; extends `AggregateError` | per-host `results` |

- `start()` catches everything into `{ success: false, error }`; narrow with `instanceof` or `isAbortError(err)` (name-based, realm-safe). `main()` also sets `process.exitCode = 1` and rethrows at debug verbosity.
- `retry` + `timeout` compose: expiry aborts with `TimeoutError` as the signal reason, which surfaces wherever the op checks cancellation (e.g. `sleep` rejects with it). `retry` skips only `AbortError`, so a `TimeoutError` **is retried** by default. Put `timeout` inside `retry` for per-attempt budgets, or pass `retryOn: (e) => !(e instanceof TimeoutError)`.
- `ctx.abort(reason?)` reports and throws `AbortError`; prefer it over a raw throw when your code decides to cancel.
- `ShellError.stdout`/`stderr` are decoded strings even when the op ran with `'buffer'` output.
