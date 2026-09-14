/**
 * @module systemd/sleep
 *
 * systemd sleep configuration management.
 *
 * @see systemd-sleep.conf(5) - Sleep configuration files
 *
 * Configuration is written to a drop-in file at:
 * /etc/systemd/sleep.conf.d/sysops.conf
 */

export const SLEEP_CONF_PATH = '/etc/systemd/sleep.conf';

/**
 * Options for configuring systemd sleep.
 *
 * All options correspond to settings in the [Sleep] section of systemd-sleep.conf.
 * See systemd-sleep.conf(5) for detailed descriptions of each option.
 */
export type SleepConf = {
  Sleep: {
    /**
     * Whether to allow suspend, hibernation, hybrid sleep,
     * and suspend-then-hibernate. By default, any mode is
     * advertised if possible.
     */
    AllowSuspend?: 'yes' | 'no';

    /**
     * Whether to allow hibernation.
     */
    AllowHibernation?: 'yes' | 'no';

    /**
     * Whether to allow hybrid sleep.
     */
    AllowHybridSleep?: 'yes' | 'no';

    /**
     * Whether to allow suspend-then-hibernate.
     */
    AllowSuspendThenHibernate?: 'yes' | 'no';

    /**
     * Power state to enter for suspend.
     * The string is written to /sys/power/state.
     * Can be a space-separated list tried in turn.
     * Common values: "mem", "standby", "freeze".
     */
    SuspendState?: string;

    /**
     * Power state to enter for hibernate.
     * The string is written to /sys/power/disk.
     * Can be a space-separated list tried in turn.
     */
    HibernateMode?: string;

    /**
     * Power state for /sys/power/mem_sleep when SuspendState=mem
     * or hybrid sleep is used. Default: empty.
     */
    MemorySleepMode?: string;

    /**
     * Delay before hibernating in suspend-then-hibernate mode.
     * After this delay, system transitions from suspend to hibernate.
     * Accepts a time span. Default: 2h.
     */
    HibernateDelaySec?: number | string;

    /**
     * Whether to allow hibernation when the system has AC power.
     * Only used by suspend-then-hibernate when HibernateDelaySec= is set.
     */
    HibernateOnACPower?: 'yes' | 'no';

    /**
     * Interval for estimating suspend duration for battery savings.
     * Used in suspend-then-hibernate mode.
     * Accepts a time span.
     */
    SuspendEstimationSec?: number | string;
  };
};
