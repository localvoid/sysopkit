---
title: coredump
description: systemd-coredump configuration types.
---

Type definitions for `coredump.conf` — the systemd-coredump configuration file.

```ts
import type { CoredumpConf } from '@sysopkit/linux/systemd/coredump';
```

## CoredumpConf

```ts
type CoredumpConf = {
  Coredump: {
    Storage?: 'none' | 'external' | 'journal' | 'auto';
    Compress?: 'yes' | 'no';
    ProcessSizeMax?: string;
    ExternalSizeMax?: string;
    JournalSizeMax?: string;
    MaxUse?: string;
    KeepFree?: string;
    EnterNamespace?: 'yes' | 'no';
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `Storage` | Where to store core dumps: `"external"` (files), `"journal"`, `"none"`, or `"auto"`. |
| `ProcessSizeMax` | Maximum core size to generate stack trace (default: 2G on 64-bit). |
| `ExternalSizeMax` | Maximum core size to save to external storage (default: 2G). |
| `JournalSizeMax` | Maximum core size to save in the journal (default: 767M). |
| `MaxUse` / `KeepFree` | Maximum disk space for cores / minimum free space to maintain. |
| `EnterNamespace` | Enter namespaces to access debug info from containerized processes. |
