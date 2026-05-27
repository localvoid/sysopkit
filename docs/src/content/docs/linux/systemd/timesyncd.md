---
title: timesyncd
description: systemd-timesyncd configuration types.
---

Type definitions for `timesyncd.conf` — the systemd-timesyncd NTP client configuration file.

```ts
import type { TimesyncdConf } from '@sysopkit/linux/systemd/timesyncd';
```

## TimesyncdConf

```ts
type TimesyncdConf = {
  Time: {
    NTP?: string;
    FallbackNTP?: string | string[];
    RootDistanceMaxSec?: number;
    PollIntervalMinSec?: number;
    PollIntervalMaxSec?: number;
    ConnectionRetrySec?: number;
    SaveIntervalSec?: number;
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `NTP` | Space-separated list of NTP server hostnames or IP addresses. |
| `FallbackNTP` | Fallback NTP servers when no other configuration is available. |
| `PollIntervalMinSec` / `PollIntervalMaxSec` | Min/max NTP poll interval (default: 32s / 2048s). |
| `RootDistanceMaxSec` | Maximum acceptable root distance before switching servers (default: 5s). |
| `ConnectionRetrySec` | Minimum delay before retrying a failed NTP server (default: 30s). |
