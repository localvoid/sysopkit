---
title: Utilities
description: retry, timeout, sleep, process management, and shell utilities.
---

## retry()

Configurable retry with fixed or exponential backoff. Skips on `AbortError` so cancellation propagates immediately.

```ts
import { retry } from 'sysopkit';

// Fixed backoff (default)
await retry(
  async () => {
    await sh('curl -s http://api/health');
  },
  { attempts: 3, delay: 1000 },
);

// Exponential backoff
await retry(
  async () => {
    await sh('curl -s http://api/health');
  },
  { attempts: 5, delay: 500, backoff: 'exponential', maxDelay: 30_000 },
);

// With retryOn predicate
await retry(
  async () => {
    // only retry on specific errors
  },
  { attempts: 3, retryOn: (err) => err instanceof TimeoutError },
);
```

## timeout()

Wraps a function with an `AbortController`-based timer. Throws `TimeoutError` if the function exceeds the limit.

```ts
import { timeout } from 'sysopkit';

await timeout(async () => {
  await sh('long-running-command');
}, 30_000);
```

## sleep()

Abort-aware delay. Rejects with `signal.reason` on cancellation.

```ts
import { sleep } from 'sysopkit';

await sleep(5000); // wait 5 seconds
```
