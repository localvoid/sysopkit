---
title: Error Handling
description: Patterns for handling errors in SysopKit scripts.
---

See [Error Classes](/reference/error-classes/) for the complete API reference of all error types.

## AbortError

Cancelled operations reject with `AbortError`, or with the abort `signal.reason` wherever the op checks cancellation (e.g. `sleep` rejects with the reason, so a `timeout()` expiry surfaces as `TimeoutError`). Use `isAbortError()` to check for plain cancellation:

```ts
import { isAbortError } from 'sysopkit';

try {
  await sh('long-running-command');
} catch (err) {
  if (isAbortError(err)) {
    // gracefully handle cancellation
    return;
  }
  throw err;
}
```

## ApplyError

When a multi-host `apply()` exceeds its failure threshold, it throws `ApplyError` with every per-host result:

```ts
import { ApplyError } from 'sysopkit';

try {
  await apply('setup', hosts.getAll(), fn, { maxFailPercent: 20 });
} catch (err) {
  if (err instanceof ApplyError) {
    for (const result of err.results) {
      if (!result.success) {
        console.error(`${result.conn.name}:`, result.error);
      }
    }
  }
}
```

## OperationError

Operations wrap their underlying failure cause in `OperationError`:

```ts
import { OperationError } from 'sysopkit';

try {
  await createFile({ path: '/etc/config', content: 'data' });
} catch (err) {
  if (err instanceof OperationError) {
    console.error('Operation failed:', err.cause);
  }
}
```

## ShellError

The `sh()` and `bash()` operations throw `ShellError` for non-zero exit codes outside the 64-78 usage-error range:

```ts
import { ShellError } from 'sysopkit/op/sh';

try {
  await sh('apt install -y nginx');
} catch (err) {
  if (err instanceof ShellError) {
    console.error(`Exit code ${err.exitCode}:`, err.stderr);
  }
}
```
