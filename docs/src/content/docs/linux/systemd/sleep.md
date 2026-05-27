---
title: sleep
description: systemd-sleep configuration types.
---

Type definitions for `sleep.conf` — the systemd-sleep configuration file.

```ts
import type { SleepConf } from '@sysopkit/linux/systemd/sleep';
```

## SleepConf

```ts
type SleepConf = {
  Sleep: {
    SuspendMode?: string;
    HibernateMode?: string;
    HybridSleepMode?: string;
    SuspendState?: string;
    HibernateState?: string;
    HybridSleepState?: string;
    HibernateDelaySec?: number | string;
    SuspendEstimationSec?: number | string;
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `SuspendMode` | Default sleep mode for suspend (e.g., `"freeze"`, `"mem"`, `"standby"`). |
| `HibernateMode` | Default sleep mode for hibernate (typically `"platform"` or `"shutdown"`). |
| `SuspendState` | Power state to enter for suspend. Common values: `"mem"`, `"standby"`, `"freeze"`. |
| `HibernateDelaySec` | Delay before hibernating in suspend-then-hibernate mode. |
