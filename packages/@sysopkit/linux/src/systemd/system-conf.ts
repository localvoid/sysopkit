/**
 * @module systemd/system-conf
 *
 * System and session service manager configuration.
 *
 * @see systemd-system.conf(5) - System and session service manager configuration files
 *
 * Configuration is read from `/etc/systemd/system.conf` (system instance)
 * and `/etc/systemd/user.conf` (user instance), with drop-ins in
 * `*.conf.d/` directories. All options live in the `[Manager]` section.
 * Serialize with `serializeIni` from `sysopkit/op/ini`.
 */

import type { OomPolicy } from './unit.js';

export const SYSTEM_CONF_PATH = '/etc/systemd/system.conf';
export const USER_CONF_PATH = '/etc/systemd/user.conf';

/**
 * Log target for the service manager.
 * @see systemd-system.conf(5) LogTarget=
 */
export type SystemManagerLogTarget =
  | 'console'
  | 'console-prefixed'
  | 'kmsg'
  | 'journal'
  | 'journal-or-kmsg'
  | 'auto'
  | 'null';

/**
 * Action when the service manager crashes (PID 1).
 * @see systemd-system.conf(5) CrashAction=
 */
export type SystemManagerCrashAction = 'freeze' | 'reboot' | 'poweroff';

/**
 * Boot status display mode.
 * @see systemd-system.conf(5) ShowStatus=
 */
export type SystemManagerShowStatus = 'yes' | 'no' | 'error' | 'auto';

/**
 * Default standard output/error for executed processes.
 * @see systemd-system.conf(5) DefaultStandardOutput=, DefaultStandardError=
 */
export type SystemManagerStandardOutput =
  | 'inherit'
  | 'null'
  | 'tty'
  | 'journal'
  | 'journal+console'
  | 'kmsg'
  | 'kmsg+console';

/**
 * Action on repeated Ctrl-Alt-Delete presses (>7 in 2s).
 * @see systemd-system.conf(5) CtrlAltDelBurstAction=
 */
export type SystemManagerCtrlAltDelBurstAction =
  | 'reboot-force'
  | 'poweroff-force'
  | 'reboot-immediate'
  | 'poweroff-immediate'
  | 'none';

/**
 * Unit identifier format in status messages.
 * @see systemd-system.conf(5) StatusUnitFormat=
 */
export type SystemManagerStatusUnitFormat = 'name' | 'description' | 'combined';

/**
 * NUMA memory policy for the service manager and forked processes.
 * `preferred-many` requires Linux 5.15+, `weighted-interleave`
 * Linux 6.9+ (weights via `/sys/kernel/mm/mempolicy/weighted_interleave/`).
 * @see systemd-system.conf(5) NUMAPolicy=
 * @see systemd.exec(5) NUMAPolicy=
 */
export type SystemManagerNUMAPolicy =
  | 'default'
  | 'preferred'
  | 'bind'
  | 'interleave'
  | 'local'
  | 'preferred-many'
  | 'weighted-interleave';

/**
 * Manager `ProtectSystem=` mode. Unlike the per-unit setting, the manager
 * only supports the boolean forms plus `auto` (no `full`/`strict`).
 * @see systemd-system.conf(5) ProtectSystem=
 */
export type SystemManagerProtectSystem = 'yes' | 'no' | 'auto';

/**
 * Memory pressure monitoring mode.
 * @see systemd-system.conf(5) DefaultMemoryPressureWatch=
 */
export type SystemManagerMemoryPressureWatch = 'yes' | 'no' | 'auto' | 'skip';

/**
 * CPU pressure monitoring mode.
 * Same values as memory pressure monitoring.
 * @see systemd-system.conf(5) DefaultCPUPressureWatch=
 */
export type SystemManagerCPUPressureWatch = 'yes' | 'no' | 'auto' | 'skip';

/**
 * IO pressure monitoring mode.
 * Same values as memory pressure monitoring.
 * @see systemd-system.conf(5) DefaultIOPressureWatch=
 */
export type SystemManagerIOPressureWatch = 'yes' | 'no' | 'auto' | 'skip';

/**
 * Filesystem access restriction for PID 1 and its children.
 * `yes` is equivalent to `exec`.
 * @see systemd-system.conf(5) RestrictFileSystemAccess=
 */
export type SystemManagerRestrictFileSystemAccess = 'yes' | 'no' | 'exec';

/**
 * Options for the system/session service manager.
 *
 * All options correspond to settings in the [Manager] section of
 * system.conf/user.conf. See systemd-system.conf(5) for detailed
 * descriptions of each option.
 */
export type SystemManagerConf = {
  Manager: {
    /**
     * Colorize log messages written to the tty.
     * Takes a boolean. Overridable via kernel command line and environment.
     */
    LogColor?: 'yes' | 'no';

    /**
     * Maximum log level of emitted messages. Takes a comma-separated list
     * of levels (`emerg`, `alert`, `crit`, `err`, `warning`, `notice`,
     * `info`, `debug`, or integers 0...7), optionally prefixed per target
     * (`console:`, `syslog:`, `kmsg:`, `journal:`).
     * Default: `info`.
     */
    LogLevel?: string;

    /**
     * Include code location (filename and line number) in log messages.
     * Takes a boolean.
     */
    LogLocation?: 'yes' | 'no';

    /**
     * Destination for log messages.
     */
    LogTarget?: SystemManagerLogTarget;

    /**
     * Prefix console log messages with a timestamp.
     * Takes a boolean.
     */
    LogTime?: 'yes' | 'no';

    /**
     * Dump core when the manager crashes. Takes a boolean.
     * Default: enabled.
     */
    DumpCore?: 'yes' | 'no';

    /**
     * Switch to the given virtual terminal (1-63) when the manager
     * crashes. Takes a positive integer or a boolean.
     * Default: disabled.
     */
    CrashChangeVT?: number | 'yes' | 'no';

    /**
     * Spawn a shell when the manager crashes. Takes a boolean.
     * Default: disabled (no password protection on the shell).
     */
    CrashShell?: 'yes' | 'no';

    /**
     * Action when the manager crashes. Default: `freeze`.
     */
    CrashAction?: SystemManagerCrashAction;

    /**
     * Show terse service status updates on the console during boot.
     * `error` shows only failures, `auto` stays quiet unless boot is
     * significantly delayed. Default: enabled (or `error` with `quiet`
     * on the kernel command line).
     */
    ShowStatus?: SystemManagerShowStatus;

    /**
     * Default stdout for executed processes. Default: `journal`.
     */
    DefaultStandardOutput?: SystemManagerStandardOutput;

    /**
     * Default stderr for executed processes. Default: `inherit`.
     */
    DefaultStandardError?: SystemManagerStandardOutput;

    /**
     * Action on >7 Ctrl-Alt-Delete presses in 2s.
     * Default: `reboot-force`.
     */
    CtrlAltDelBurstAction?: SystemManagerCtrlAltDelBurstAction;

    /**
     * Whether status messages use unit names, descriptions, or both.
     */
    StatusUnitFormat?: SystemManagerStatusUnitFormat;

    /**
     * Global default for `AccuracySec=` of timer units.
     * Accepts a time span. Default: 1min.
     */
    DefaultTimerAccuracySec?: number | string;

    /**
     * Timer slack in nanoseconds for PID 1, inherited by all executed
     * processes unless overridden per unit. Takes an integer in
     * nanoseconds when unitless; usual time units are also understood.
     */
    TimerSlackNSec?: number | string;

    /**
     * CPU affinity for the manager and the default for forked processes.
     * Takes a list of CPU indices or ranges separated by whitespace or
     * commas (e.g. `0 1`, `0-3,8-11`). May be specified more than once
     * (masks are merged); assign the empty string to reset.
     */
    CPUAffinity?: string;

    /**
     * NUMA memory policy for the manager and the default for forked
     * processes. Per-unit `NUMAPolicy=` overrides it.
     */
    NUMAPolicy?: SystemManagerNUMAPolicy;

    /**
     * NUMA node mask associated with `NUMAPolicy=`. Same CPU-list syntax
     * as `CPUAffinity=`, or the special value `all`. Not required for
     * `default` and `local` policies.
     */
    NUMAMask?: string;

    /**
     * Default per-unit memory accounting (`MemoryAccounting=`).
     * Default: yes.
     */
    DefaultMemoryAccounting?: 'yes' | 'no';

    /**
     * Default per-unit task accounting (`TasksAccounting=`).
     * Default: yes.
     */
    DefaultTasksAccounting?: 'yes' | 'no';

    /**
     * Default per-unit IO accounting (`IOAccounting=`).
     * Default: no.
     */
    DefaultIOAccounting?: 'yes' | 'no';

    /**
     * Default per-unit IP accounting (`IPAccounting=`).
     * Default: no.
     */
    DefaultIPAccounting?: 'yes' | 'no';

    /**
     * Default per-unit task limit (`TasksMax=`). Takes a percentage
     * (relative to the kernel pid limit), an absolute number, or
     * `infinity`. Default: 15% of the minimum of `kernel.pid_max=`,
     * `kernel.threads-max=` and the root cgroup `pids.max`.
     */
    DefaultTasksMax?: number | string;

    /**
     * Default `CPUAccounting=` for all units.
     * @deprecated CPU accounting is always available on the unified
     * cgroup hierarchy; this setting has no effect.
     */
    DefaultCPUAccounting?: 'yes' | 'no';

    /**
     * Default `BlockIOAccounting=` for all units.
     * @deprecated Block IO accounting only applies to the legacy
     * cgroup hierarchy; switch to the unified hierarchy.
     */
    DefaultBlockIOAccounting?: 'yes' | 'no';

    /**
     * Default resource limits for processes executed by units
     * (`LimitCPU=`, `LimitFSIZE=`, ...). Same syntax as the per-unit
     * `LimitXXX=` settings (see systemd.exec(5)); limits are inherited
     * from the kernel/container manager when unset, except
     * `DefaultLimitNOFILE=` (default `1024:524288`) and
     * `DefaultLimitMEMLOCK=` (default `8M`). Not applied to PID 1 itself.
     */
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

    /**
     * Global default for the per-unit `OOMPolicy=` setting. Not used for
     * units with `Delegate=` turned on. See systemd.service(5).
     */
    DefaultOOMPolicy?: OomPolicy;

    /**
     * Default OOM score adjustment for processes run by the manager
     * (global default for per-unit `OOMScoreAdjust=`). Takes an integer
     * between -1000 and 1000. Unset by default (processes inherit the
     * manager's adjustment).
     */
    DefaultOOMScoreAdjust?: number;

    /**
     * Default for per-unit `MemoryPressureWatch=`. Default: `auto`.
     */
    DefaultMemoryPressureWatch?: SystemManagerMemoryPressureWatch;

    /**
     * Default for per-unit `MemoryPressureThresholdSec=`.
     * Accepts a time span. Default: `200ms`.
     */
    DefaultMemoryPressureThresholdSec?: number | string;

    /**
     * Default for per-unit `CPUPressureWatch=`. Default: `auto`.
     */
    DefaultCPUPressureWatch?: SystemManagerCPUPressureWatch;

    /**
     * Default for per-unit `CPUPressureThresholdSec=`.
     * Accepts a time span. Default: `200ms`.
     */
    DefaultCPUPressureThresholdSec?: number | string;

    /**
     * Default for per-unit `IOPressureWatch=`. Default: `auto`.
     */
    DefaultIOPressureWatch?: SystemManagerIOPressureWatch;

    /**
     * Default for per-unit `IOPressureThresholdSec=`.
     * Accepts a time span. Default: `200ms`.
     */
    DefaultIOPressureThresholdSec?: number | string;

    /**
     * Default for per-unit `MemoryZSwapWriteback=`. Takes a boolean.
     * Default: yes.
     */
    DefaultMemoryZSwapWriteback?: 'yes' | 'no';

    /**
     * Hardware watchdog timeout at runtime. Takes a time value, `off`
     * (or `0`) to disable, or `default` to ping without changing the
     * timeout. Default: off.
     */
    RuntimeWatchdogSec?: number | string;

    /**
     * Hardware watchdog timeout during the reboot phase (after regular
     * services are terminated). Same syntax as `RuntimeWatchdogSec=`.
     * Default: 10min.
     */
    RebootWatchdogSec?: number | string;

    /**
     * Hardware watchdog timeout for kexec boots. Same syntax as
     * `RuntimeWatchdogSec=`. Only enable together with
     * `RuntimeWatchdogSec=`, otherwise a kexec reboot may trigger the
     * watchdog.
     */
    KExecWatchdogSec?: number | string;

    /**
     * Hardware watchdog pre-timeout: notification generated this long
     * before the runtime watchdog would fire (must be smaller than
     * `RuntimeWatchdogSec=`). Takes a time value. Default: 0 (off).
     * Requires pre-timeout-capable watchdog hardware/driver.
     */
    RuntimeWatchdogPreSec?: number | string;

    /**
     * Action taken by the watchdog hardware when the pre-timeout
     * expires (e.g. `noop`, `panic`; see
     * `/sys/class/watchdog/watchdogX/pretimeout_available_governors`).
     */
    RuntimeWatchdogPreGovernor?: string;

    /**
     * Hardware watchdog device used by the runtime/shutdown timers.
     * Default: `/dev/watchdog0`.
     */
    WatchdogDevice?: string;

    /**
     * Capabilities in the bounding set for PID 1 and its children.
     * Takes a whitespace-separated list of capability names
     * (e.g. `CAP_SYS_ADMIN CAP_DAC_OVERRIDE`); prefix with `~` to
     * invert. Capabilities dropped for PID 1 cannot be regained by
     * individual units.
     */
    CapabilityBoundingSet?: string;

    /**
     * Never gain new privileges via execve (setuid/setgid bits,
     * filesystem capabilities) for PID 1 and all children.
     * Cannot be disabled per unit. Default: no.
     */
    NoNewPrivileges?: 'yes' | 'no';

    /**
     * Remount `/usr/` read-only (`yes`), or automatically when running
     * in an initrd (`auto`, the default).
     */
    ProtectSystem?: SystemManagerProtectSystem;

    /**
     * Restrict filesystem access for PID 1 and its children via a BPF
     * LSM deny-default execution policy (only signed dm-verity binaries
     * may execute). Takes a boolean or `exec` (`yes` equals `exec`).
     * Default: `no`.
     */
    RestrictFileSystemAccess?: SystemManagerRestrictFileSystemAccess;

    /**
     * Architectures system calls may be invoked from (e.g. `native` to
     * prohibit non-native binaries). Takes a space-separated list of
     * architecture identifiers (`x86`, `x86-64`, `x32`, `arm`, ...,
     * `native`). Empty list (default) disables filtering.
     */
    SystemCallArchitectures?: string;

    /**
     * Default SMACK64 process label for units without an explicit
     * `SmackProcessLabel=`. The value `/` selects only explicitly
     * configured labels (ignores the compile-time default).
     */
    DefaultSmackProcessLabel?: string;

    /**
     * Default for per-unit `RestrictSUIDSGID=`. Takes a boolean.
     * Default: off.
     */
    DefaultRestrictSUIDSGID?: 'yes' | 'no';

    /**
     * Default timeouts for starting/stopping/aborting units and the
     * delay between automatic restarts (per-unit `TimeoutStartSec=`,
     * `TimeoutStopSec=`, `TimeoutAbortSec=`, `RestartSec=`).
     * `DefaultTimeoutStartSec=`/`DefaultTimeoutStopSec=` default to 90s.
     * `DefaultTimeoutAbortSec=` is unset by default (falls back to
     * `TimeoutStopSec=`). `DefaultRestartSec=` defaults to 100ms.
     */
    DefaultTimeoutStartSec?: number | string;
    DefaultTimeoutStopSec?: number | string;
    DefaultTimeoutAbortSec?: number | string;
    DefaultRestartSec?: number | string;

    /**
     * Default timeout for waiting for devices (overridable per device
     * via `x-systemd.device-timeout=` in fstab/crypttab).
     * Default: 90s.
     */
    DefaultDeviceTimeoutSec?: number | string;

    /**
     * Default unit start rate limiting (per-unit `StartLimitIntervalSec=`
     * / `StartLimitBurst=`). Defaults: 10s / 5.
     */
    DefaultStartLimitIntervalSec?: number | string;
    DefaultStartLimitBurst?: number;

    /**
     * Rate limiting for `daemon-reload` and `daemon-reexec` requests.
     * `ReloadLimitIntervalSec=` configures the window,
     * `ReloadLimitBurst=` the maximum operations per window. Unset by
     * default (unlimited).
     */
    ReloadLimitIntervalSec?: number | string;
    ReloadLimitBurst?: number;

    /**
     * Rate limiting for the manager's main event loop. Event processing
     * pauses briefly when iterations exceed `EventLoopRateLimitBurst=`
     * within `EventLoopRateLimitIntervalSec=`.
     * Defaults: 1s / 50000.
     */
    EventLoopRateLimitIntervalSec?: number | string;
    EventLoopRateLimitBurst?: number;

    /**
     * Minimum system uptime before a shutdown is executed (delays
     * reboot loops so screen contents can be reviewed). Takes a time
     * span. Default: 15s. Set to 0 to disable. Skipped in containers.
     */
    MinimumUptimeSec?: number | string;

    /**
     * Environment variables passed to all executed processes. Takes a
     * space-separated list of `VARIABLE=value` assignments (quoting with
     * `"` supported). Supports `%`-specifiers (see
     * systemd-system.conf(5), Specifiers).
     */
    DefaultEnvironment?: string;

    /**
     * Environment variables for the manager process itself, merged into
     * its existing environment (kernel command line for the system
     * manager) and persisted across reloads/reexecs. Same format as
     * `DefaultEnvironment=`.
     */
    ManagerEnvironment?: string;
  };
};
