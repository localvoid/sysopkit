---
title: wget
description: Download files via wget.
---

```ts
import { wget } from 'sysopkit/op/wget';
```

## wget()

Downloads a file via `wget`.

```ts
await wget('https://example.com/file.tar.gz', '/tmp/file.tar.gz');
```

Pass additional wget flags via the `flags` option.

```ts
await wget('https://example.com/file.tar.gz', '/tmp/file.tar.gz', {
  flags: ['--no-check-certificate'],
});
```
