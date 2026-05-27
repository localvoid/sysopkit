---
title: Error Handling
description: Patterns for handling errors in SysopKit scripts.
---

See [Error Classes](/reference/error-classes/) for the complete API reference of all error types.

## AbortError

Use `isAbortError()` to check for cancellation:

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

In multi-host mode, `ApplyError` carries all per-host results:

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

Wraps the underlying cause of an operation failure:

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

Thrown by `sh()` and `bash()` for non-zero exit codes outside the 64-78 usage error range:

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
