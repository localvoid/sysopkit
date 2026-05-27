---
title: wget
description: File download via wget.
---

```ts
import { wget } from 'sysopkit/op/wget';
```

## wget()

Downloads a file via `wget`:

```ts
await wget('https://example.com/file.tar.gz', '/tmp/file.tar.gz');
```

Supports additional wget flags:

```typescript
await wget('https://example.com/file.tar.gz', '/tmp/file.tar.gz', {
  flags: ['--no-check-certificate'],
});
```
