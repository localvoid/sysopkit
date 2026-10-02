---
title: Utilities
description: retry, timeout, sleep, wait, process management, and shell utilities.
---

## retry()

Retries a function with fixed or exponential backoff. Skips `AbortError` so cancellation propagates immediately. Note: `timeout()` expiry aborts with `TimeoutError`, which **is** retried by default — filter it with `retryOn` if you want to stop after the first timeout.

```ts
import { retry, TimeoutError } from 'sysopkit';

// Fixed backoff (default)
await retry({ attempts: 3, delay: 1000 }, async () => {
  await sh('curl -s http://api/health');
});

// Exponential backoff
await retry({ attempts: 5, delay: 500, backoff: 'exponential', maxDelay: 30_000 }, async () => {
  await sh('curl -s http://api/health');
});

// With retryOn predicate
await retry({ attempts: 3, retryOn: (err) => err instanceof TimeoutError }, async () => {
  // only retry on specific errors
});
```

## waitUntil()

Polls a predicate until it returns `true`. `false` and `retryOn`-matching throws are "not yet"; anything else propagates immediately. Always fails closed at `timeoutMs` with a labeled `TimeoutError`. Reboot-tolerant: the default `retryOn` treats `ConnectorError` + `ExecError`/`ShellError` (e.g. ssh exit 255 while the target is down) as "not yet". Override with `retryOn: () => false` for fail-fast uses.

```ts
import { waitUntil } from 'sysopkit';

// File content (missing file is naturally "not yet")
await waitUntil(async () => ((await tryReadFile('/proc/cmdline')) ?? '').includes('break=mount'), {
  timeoutMs: 20 * 60_000,
  describe: 'rescue cmdline',
});

// Inequality predicate (boot-id change)
await waitUntil(async () => (await bootId()) !== before, {
  describe: 'reboot to complete',
});
```

| Option       | Default                        | Description                                |
| ------------ | ------------------------------ | ------------------------------------------ |
| `intervalMs` | `1000`                         | Poll interval in ms                        |
| `timeoutMs`  | `600000` (10 min)              | Total budget before `TimeoutError`         |
| `retryOn`    | `ConnectorError` + `ExecError` | Probe throws counting as "not yet"         |
| `describe`   | `'condition'`                  | Human label for task name + timeout errors |
| `signal`     | —                              | AbortSignal for cancellation               |

## waitForReady()

Polls a live connector's side-effect-free `isReady()` until it returns `true`. Takes a live instance (not a factory).

```ts
import { waitForReady } from 'sysopkit';

await waitForReady(new SSHConnector({ host: '10.0.1.1' }));
```

## timeout()

Runs a function with an `AbortController`-based timer, aborting with `TimeoutError` if the function exceeds the limit. What surfaces at your call site depends on where the op checks cancellation (e.g. `sleep` rejects with the `TimeoutError` reason).

```ts
import { timeout } from 'sysopkit';

await timeout(30_000, async () => {
  await sh('long-running-command');
});
```

## sleep()

An abort-aware delay that rejects with `signal.reason` on cancellation.

```ts
import { sleep } from 'sysopkit';

await sleep(5000); // wait 5 seconds
```
