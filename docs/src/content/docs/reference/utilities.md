---
title: Utilities
description: retry, timeout, sleep, process management, and shell utilities.
---

## retry()

Retries a function with fixed or exponential backoff. Skips `AbortError` so cancellation propagates immediately. Note: `timeout()` expiry aborts with `TimeoutError`, which **is** retried by default — filter it with `retryOn` if you want to stop after the first timeout.

```ts
import { retry, TimeoutError } from 'sysopkit';

// Fixed backoff (default)
await retry(
  { attempts: 3, delay: 1000 },
  async () => {
    await sh('curl -s http://api/health');
  },
);

// Exponential backoff
await retry(
  { attempts: 5, delay: 500, backoff: 'exponential', maxDelay: 30_000 },
  async () => {
    await sh('curl -s http://api/health');
  },
);

// With retryOn predicate
await retry(
  { attempts: 3, retryOn: (err) => err instanceof TimeoutError },
  async () => {
    // only retry on specific errors
  },
);
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
