/**
 * @module systemd/logind
 *
 * systemd-logind configuration management.
 *
 * @see logind.conf(5) - Login manager configuration files
 *
 * Configuration is written to a drop-in file at:
 * /etc/systemd/logind.conf.d/sysops.conf
 */

export const LOGIND_CONF_PATH = '/etc/systemd/logind.conf';

/**
 * Action types for power/sleep key and lid switch handling.
 * @see logind.conf(5) HandlePowerKey= and related options
 */
export type LogindHandleAction =
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
  | 'lock'
  | 'factory-reset';

/**
 * Options for configuring systemd-logind.
 *
 * All options correspond to settings in the [Login] section of logind.conf.
 * See logind.conf(5) for detailed descriptions of each option.
 */
export type LogindConf = {
  Login: {
    /**
     * Number of virtual terminals to allocate for autovt services.
     * These VTs automatically spawn getty when switched to.
     * Default: 6. Set to 0 to disable.
     */
    NAutoVTs?: number;

    /**
     * VT number to unconditionally reserve for autovt.
     * Ensures a getty is always available. Default: 6.
     */
    ReserveVT?: number;

    /**
     * Kill user processes when user logs out completely.
     * - true: Kill all processes in user's session scope
     * - false: Abandon scope, let processes continue
     * Default: no. Note: breaks screen/tmux unless they're moved out of session.
     */
    KillUserProcesses?: 'yes' | 'no';

    /**
     * Space-separated list of users whose processes are always killed on logout.
     * Only relevant if KillUserProcesses=yes.
     */
    KillOnlyUsers?: string;

    /**
     * Space-separated list of users excluded from kill-on-logout.
     * Default includes "root". Set empty to remove default.
     */
    KillExcludeUsers?: string;

    /**
     * Action to take when system is idle.
     * Default: "ignore" (no action).
     */
    IdleAction?: LogindHandleAction;

    /**
     * Delay after system becomes idle before taking IdleAction.
     */
    IdleActionSec?: number;

    /**
     * Maximum time to delay shutdown/sleep for inhibitor locks.
     * Default: 5 seconds.
     */
    InhibitDelayMaxSec?: number;

    /**
     * How long to keep user@.service around after user logs out.
     * Speeds up rapid logout/login cycles. Default: 10s.
     * Set to "infinity" to never stop user service.
     */
    UserStopDelaySec?: number | 'infinity';

    /**
     * Action when power button is pressed. Default: "poweroff".
     */
    HandlePowerKey?: LogindHandleAction;

    /**
     * Action when power button is long-pressed. Default: "ignore".
     */
    HandlePowerKeyLongPress?: LogindHandleAction;

    /**
     * Action when reboot button is pressed. Default: "reboot".
     */
    HandleRebootKey?: LogindHandleAction;

    /**
     * Action when reboot button is long-pressed. Default: "poweroff".
     */
    HandleRebootKeyLongPress?: LogindHandleAction;

    /**
     * Action when suspend key is pressed. Default: "suspend".
     */
    HandleSuspendKey?: LogindHandleAction;

    /**
     * Action when suspend key is long-pressed. Default: "hibernate".
     */
    HandleSuspendKeyLongPress?: LogindHandleAction;

    /**
     * Action when hibernate key is pressed. Default: "hibernate".
     */
    HandleHibernateKey?: LogindHandleAction;

    /**
     * Action when hibernate key is long-pressed. Default: "ignore".
     */
    HandleHibernateKeyLongPress?: LogindHandleAction;

    /**
     * Action when lid is closed. Default: "suspend".
     */
    HandleLidSwitch?: LogindHandleAction;

    /**
     * Action when lid is closed on external power. Default: not set (ignored).
     */
    HandleLidSwitchExternalPower?: LogindHandleAction;

    /**
     * Action when lid is closed while docked/multiple displays.
     * Default: "ignore".
     */
    HandleLidSwitchDocked?: LogindHandleAction;

    /**
     * Ignore inhibitor locks for power key. Default: no.
     */
    PowerKeyIgnoreInhibited?: 'yes' | 'no';

    /**
     * Ignore inhibitor locks for suspend key. Default: no.
     */
    SuspendKeyIgnoreInhibited?: 'yes' | 'no';

    /**
     * Ignore inhibitor locks for hibernate key. Default: no.
     */
    HibernateKeyIgnoreInhibited?: 'yes' | 'no';

    /**
     * Ignore inhibitor locks for lid switch. Default: yes.
     */
    LidSwitchIgnoreInhibited?: 'yes' | 'no';

    /**
     * Ignore inhibitor locks for reboot key. Default: no.
     */
    RebootKeyIgnoreInhibited?: 'yes' | 'no';

    /**
     * Time to wait after boot/resume before reacting to lid events.
     * Allows hotplugged devices to be detected. Default: 30s.
     */
    HoldoffTimeoutSec?: number;

    /**
     * Size limit for $XDG_RUNTIME_DIR. Accepts K, M, G, T suffixes or %.
     * Default: 10% of RAM.
     */
    RuntimeDirectorySize?: string;

    /**
     * Maximum inodes for $XDG_RUNTIME_DIR.
     * Default: RuntimeDirectorySize / 4096.
     */
    RuntimeDirectoryInodesMax?: number | string;

    /**
     * Maximum concurrent inhibitors. Default: 8192.
     */
    InhibitorsMax?: number;

    /**
     * Maximum concurrent user sessions. Default: 8192.
     */
    SessionsMax?: number;

    /**
     * Remove System V and POSIX IPC objects when user logs out completely.
     * Default: yes.
     */
    RemoveIPC?: 'yes' | 'no';

    /**
     * Timeout after which idle sessions are stopped.
     * Does not apply to greeter/lock-screen sessions.
     * Default: "infinity" (disabled).
     */
    StopIdleSessionSec?: number | 'infinity';
  };
};
