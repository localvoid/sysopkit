---
title: proc
description: Wait for processes to start or stop.
---

```ts
import { waitProcess } from 'sysopkit/op/proc';
```

## waitProcess()

Waits for a process to reach the desired state, matching the exact process name with `pidof`.

```ts
// Wait for nginx to start
await waitProcess({ process: 'nginx', state: 'active', delay: 1000 });

// Wait for nginx to stop
await waitProcess({ process: 'nginx', state: 'terminated', delay: 500 });
```

| Option    | Default    | Description                         |
| --------- | ---------- | ----------------------------------- |
| `process` | —          | Process name to wait for (required) |
| `state`   | `'active'` | `'active'` or `'terminated'`        |
| `delay`   | `1000`     | Poll interval in ms                 |
