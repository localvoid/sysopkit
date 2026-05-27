---
title: Tuned
description: Tuned profile management operations.
---

Tuned is a daemon that dynamically tunes system settings for different workloads (throughput, latency, powersave, etc.).

```ts
import { setTuneProfile } from '@sysopkit/linux/tuned';
```

## setTuneProfile()

> **IDEMPOTENT**

Activates a tuned profile using `tuned-adm profile`. Pass `null` to disable tuned. Reads the current profile from `/etc/tuned/active_profile` to determine if a change is needed.

```ts
await setTuneProfile({ profile: 'throughput-performance' });

await setTuneProfile({ profile: null }); // disable tuned
```
