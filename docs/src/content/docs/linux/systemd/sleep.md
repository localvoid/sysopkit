---
title: sleep
description: systemd sleep configuration types.
---

Type definitions for `systemd-sleep.conf` — the systemd sleep configuration file.

```ts
import type { SleepConf } from '@sysopkit/linux/systemd/sleep';
```

## SleepConf

```ts
type SleepConf = {
  Sleep: {
    AllowSuspend?: 'yes' | 'no';
    AllowHibernation?: 'yes' | 'no';
    AllowHybridSleep?: 'yes' | 'no';
    AllowSuspendThenHibernate?: 'yes' | 'no';
    SuspendState?: string;
    HibernateMode?: string;
    MemorySleepMode?: string;
    HibernateDelaySec?: number | string;
    HibernateOnACPower?: 'yes' | 'no';
    SuspendEstimationSec?: number | string;
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `SuspendState` | Power state to enter for suspend. Common values: `"mem"`, `"standby"`, `"freeze"`. |
| `HibernateMode` | Power state to enter for hibernate (typically `"platform"` or `"shutdown"`). |
| `HibernateDelaySec` | Delay before hibernating in suspend-then-hibernate mode. |
