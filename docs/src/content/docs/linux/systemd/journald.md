---
title: journald
description: systemd-journald configuration types.
---

Type definitions for `journald.conf` — the systemd-journald configuration file.

```ts
import type { JournaldConf } from '@sysopkit/linux/systemd';
```

## JournaldConf

```ts
type JournaldConf = {
  Journal: {
    Storage?: 'volatile' | 'persistent' | 'auto' | 'none';
    Compress?: string;
    Seal?: 'yes' | 'no';
    SplitMode?: 'uid' | 'none';
    RateLimitIntervalSec?: number;
    RateLimitBurst?: number;
    SystemMaxUse?: string;
    SystemKeepFree?: string;
    SystemMaxFileSize?: string;
    SystemMaxFiles?: number;
    RuntimeMaxUse?: string;
    RuntimeKeepFree?: string;
    RuntimeMaxFileSize?: string;
    RuntimeMaxFiles?: number;
    MaxFileSec?: string;
    MaxRetentionSec?: string;
    SyncIntervalSec?: number;
    ForwardToSyslog?: 'yes' | 'no';
    ForwardToKMsg?: 'yes' | 'no';
    ForwardToConsole?: 'yes' | 'no';
    ForwardToWall?: 'yes' | 'no';
    ForwardToSocket?: string;
    TTYPath?: string;
    LineMax?: string;
    MaxLevelStore?: string;
    MaxLevelSyslog?: string;
    MaxLevelKMsg?: string;
    MaxLevelConsole?: string;
    MaxLevelWall?: string;
    MaxLevelSocket?: string;
    ReadKMsg?: 'yes' | 'no';
    Audit?: 'yes' | 'no' | 'keep';
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `Storage` | Where to store journal data. `"persistent"` stores on disk, `"volatile"` uses memory only. |
| `SystemMaxUse` | Maximum disk space for persistent journal. Accepts K/M/G suffixes. |
| `ForwardToSyslog` | Forward log messages to traditional syslog daemon. |
| `ForwardToKMsg` | Forward messages to kernel log buffer. |
| `RateLimitIntervalSec` / `RateLimitBurst` | Rate limiting: interval in seconds and max messages per interval. |
| `Compress` | Enable compression for large journal entries (default: yes). |
