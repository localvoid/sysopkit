---
title: system.conf
description: System and session service manager configuration types.
---

Type definitions for `system.conf` / `user.conf` — the system and session service manager configuration files (`systemd-system.conf(5)`). All options live in the `[Manager]` section. Serialize with `serializeIni` from `sysopkit/op/ini`, write to `/etc/systemd/system.conf` (system) or `/etc/systemd/user.conf` (user) — or preferably a drop-in under `*.conf.d/` — then `daemon-reload`.

```ts
import type {
  SystemManagerConf,
  SystemManagerCrashAction,
  SystemManagerCtrlAltDelBurstAction,
  SystemManagerCPUPressureWatch,
  SystemManagerIOPressureWatch,
  SystemManagerLogTarget,
  SystemManagerMemoryPressureWatch,
  SystemManagerNUMAPolicy,
  SystemManagerProtectSystem,
  SystemManagerRestrictFileSystemAccess,
  SystemManagerShowStatus,
  SystemManagerStandardOutput,
  SystemManagerStatusUnitFormat,
} from '@sysopkit/linux/systemd';
import { SYSTEM_CONF_PATH, USER_CONF_PATH } from '@sysopkit/linux/systemd';
```

## SystemManagerConf

```ts
type SystemManagerConf = {
  Manager: {
    LogColor?: 'yes' | 'no';
    LogLevel?: string;
    LogLocation?: 'yes' | 'no';
    LogTarget?: SystemManagerLogTarget;
    LogTime?: 'yes' | 'no';
    DumpCore?: 'yes' | 'no';
    CrashChangeVT?: number | 'yes' | 'no';
    CrashShell?: 'yes' | 'no';
    CrashAction?: SystemManagerCrashAction;
    ShowStatus?: SystemManagerShowStatus;
    DefaultStandardOutput?: SystemManagerStandardOutput;
    DefaultStandardError?: SystemManagerStandardOutput;
    CtrlAltDelBurstAction?: SystemManagerCtrlAltDelBurstAction;
    StatusUnitFormat?: SystemManagerStatusUnitFormat;
    DefaultTimerAccuracySec?: number | string;
    TimerSlackNSec?: number | string;
    CPUAffinity?: string;
    NUMAPolicy?: SystemManagerNUMAPolicy;
    NUMAMask?: string;
    DefaultMemoryAccounting?: 'yes' | 'no';
    DefaultTasksAccounting?: 'yes' | 'no';
    DefaultIOAccounting?: 'yes' | 'no';
    DefaultIPAccounting?: 'yes' | 'no';
    DefaultTasksMax?: number | string;
    DefaultCPUAccounting?: 'yes' | 'no';
    DefaultBlockIOAccounting?: 'yes' | 'no';
    DefaultLimitCPU?: string;
    DefaultLimitFSIZE?: string;
    DefaultLimitDATA?: string;
    DefaultLimitSTACK?: string;
    DefaultLimitCORE?: string;
    DefaultLimitRSS?: string;
    DefaultLimitNOFILE?: string;
    DefaultLimitAS?: string;
    DefaultLimitNPROC?: string;
    DefaultLimitMEMLOCK?: string;
    DefaultLimitLOCKS?: string;
    DefaultLimitSIGPENDING?: string;
    DefaultLimitMSGQUEUE?: string;
    DefaultLimitNICE?: string;
    DefaultLimitRTPRIO?: string;
    DefaultLimitRTTIME?: string;
    DefaultOOMPolicy?: OomPolicy;
    DefaultOOMScoreAdjust?: number;
    DefaultMemoryPressureWatch?: SystemManagerMemoryPressureWatch;
    DefaultMemoryPressureThresholdSec?: number | string;
    DefaultCPUPressureWatch?: SystemManagerCPUPressureWatch;
    DefaultCPUPressureThresholdSec?: number | string;
    DefaultIOPressureWatch?: SystemManagerIOPressureWatch;
    DefaultIOPressureThresholdSec?: number | string;
    DefaultMemoryZSwapWriteback?: 'yes' | 'no';
    RuntimeWatchdogSec?: number | string;
    RebootWatchdogSec?: number | string;
    KExecWatchdogSec?: number | string;
    RuntimeWatchdogPreSec?: number | string;
    RuntimeWatchdogPreGovernor?: string;
    WatchdogDevice?: string;
    CapabilityBoundingSet?: string;
    NoNewPrivileges?: 'yes' | 'no';
    ProtectSystem?: SystemManagerProtectSystem;
    RestrictFileSystemAccess?: SystemManagerRestrictFileSystemAccess;
    SystemCallArchitectures?: string;
    DefaultSmackProcessLabel?: string;
    DefaultRestrictSUIDSGID?: 'yes' | 'no';
    DefaultTimeoutStartSec?: number | string;
    DefaultTimeoutStopSec?: number | string;
    DefaultTimeoutAbortSec?: number | string;
    DefaultRestartSec?: number | string;
    DefaultDeviceTimeoutSec?: number | string;
    DefaultStartLimitIntervalSec?: number | string;
    DefaultStartLimitBurst?: number;
    ReloadLimitIntervalSec?: number | string;
    ReloadLimitBurst?: number;
    EventLoopRateLimitIntervalSec?: number | string;
    EventLoopRateLimitBurst?: number;
    MinimumUptimeSec?: number | string;
    DefaultEnvironment?: string;
    ManagerEnvironment?: string;
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `LogTarget` | Log destination: `"console"`, `"kmsg"`, `"journal"`, `"journal-or-kmsg"`, `"auto"`, `"null"`. |
| `CrashAction` | Action when PID 1 crashes: `"freeze"` (default), `"reboot"`, `"poweroff"`. |
| `ShowStatus` | Boot status display: `"yes"`, `"no"`, `"error"`, `"auto"`. |
| `DefaultStandardOutput` / `DefaultStandardError` | Defaults for `StandardOutput=` / `StandardError=` (`"journal"` / `"inherit"`). |
| `CtrlAltDelBurstAction` | Action on >7 Ctrl-Alt-Del presses in 2s (default: `"reboot-force"`). |
| `DefaultTimeoutStartSec` / `DefaultTimeoutStopSec` | Default unit start/stop timeouts (default: 90s). |
| `DefaultDeviceTimeoutSec` | Default device wait timeout (default: 90s). |
| `ProtectSystem` | Remount `/usr/` read-only (`"yes"`) or auto in initrd (`"auto"`, default). Manager subset only — no `"full"`/`"strict"`. |
| `RestrictFileSystemAccess` | BPF LSM deny-default execution policy (`"yes"` equals `"exec"`; default: `"no"`). |
| `DefaultMemoryPressureWatch` / `DefaultCPUPressureWatch` / `DefaultIOPressureWatch` | Pressure monitoring defaults (`"auto"` / `200ms` thresholds). |
| `MinimumUptimeSec` | Minimum uptime before shutdown executes (default: 15s; `0` disables). |
| `DefaultEnvironment` / `ManagerEnvironment` | Environment for spawned processes / the manager process itself. |
