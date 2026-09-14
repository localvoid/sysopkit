---
title: logind
description: systemd-logind configuration types.
---

Type definitions for `logind.conf` — the systemd-logind (login manager) configuration file.

```ts
import type {
  LogindConf,
  LogindHandleAction,
  LogindIdleAction,
} from '@sysopkit/linux/systemd/logind';
```

## LogindConf

```ts
type LogindIdleAction =
  | 'ignore'
  | 'poweroff'
  | 'reboot'
  | 'halt'
  | 'kexec'
  | 'suspend'
  | 'hibernate'
  | 'hybrid-sleep'
  | 'suspend-then-hibernate'
  | 'sleep'
  | 'lock';

type LogindHandleAction = LogindIdleAction | 'factory-reset' | 'secure-attention-key';

type LogindConf = {
  Login: {
    NAutoVTs?: number;
    ReserveVT?: number;
    KillUserProcesses?: 'yes' | 'no';
    KillOnlyUsers?: string;
    KillExcludeUsers?: string;
    IdleAction?: LogindIdleAction;
    IdleActionSec?: number | string;
    InhibitDelayMaxSec?: number | string;
    UserStopDelaySec?: number | string;
    SleepOperation?: string;
    HandlePowerKey?: LogindHandleAction;
    HandlePowerKeyLongPress?: LogindHandleAction;
    HandleRebootKey?: LogindHandleAction;
    HandleRebootKeyLongPress?: LogindHandleAction;
    HandleSuspendKey?: LogindHandleAction;
    HandleSuspendKeyLongPress?: LogindHandleAction;
    HandleHibernateKey?: LogindHandleAction;
    HandleHibernateKeyLongPress?: LogindHandleAction;
    HandleLidSwitch?: LogindHandleAction;
    HandleLidSwitchExternalPower?: LogindHandleAction;
    HandleLidSwitchDocked?: LogindHandleAction;
    HandleSecureAttentionKey?: LogindHandleAction;
    PowerKeyIgnoreInhibited?: 'yes' | 'no';
    SuspendKeyIgnoreInhibited?: 'yes' | 'no';
    HibernateKeyIgnoreInhibited?: 'yes' | 'no';
    LidSwitchIgnoreInhibited?: 'yes' | 'no';
    RebootKeyIgnoreInhibited?: 'yes' | 'no';
    HoldoffTimeoutSec?: number | string;
    RuntimeDirectorySize?: string;
    RuntimeDirectoryInodesMax?: number | string;
    InhibitorsMax?: number;
    SessionsMax?: number;
    RemoveIPC?: 'yes' | 'no';
    StopIdleSessionSec?: number | string;
    DesignatedMaintenanceTime?: string;
    WallMessages?: 'yes' | 'no';
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `NAutoVTs` | Number of virtual terminals to allocate for autovt services (default: 6). |
| `KillUserProcesses` | Kill user processes when user logs out completely. |
| `HandleLidSwitch` | Action when laptop lid is closed. |
| `HandlePowerKey` | Action when power button is pressed. |
| `HandleSuspendKey` / `HandleHibernateKey` | Action for sleep keys. |
| `InhibitDelayMaxSec` | Maximum delay for inhibitor locks before shutdown/sleep. |
| `RemoveIPC` | Remove SysV/POSIX IPC objects when user logs out (default: yes). |
