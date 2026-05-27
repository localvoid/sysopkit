---
title: proc
description: Process management operations.
---

```ts
import { waitProcess } from 'sysopkit/op/proc';
```

## waitProcess()

Waits for a process to start or stop:

```ts
// Wait for nginx to start
await waitProcess({ name: 'nginx', state: 'running', delay: 1000 });

// Wait for nginx to stop
await waitProcess({ name: 'nginx', state: 'stopped', delay: 500 });
```
