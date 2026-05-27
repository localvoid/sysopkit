/**
 * @module systemd/sleep
 *
 * systemd-sleep configuration management.
 *
 * @see sleep.conf(5) - Sleep configuration files
 *
 * Configuration is written to a drop-in file at:
 * /etc/systemd/sleep.conf.d/sysops.conf
 */

export const SLEEP_CONF_PATH = '/etc/systemd/sleep.conf';

/**
 * Options for configuring systemd-sleep.
 *
 * All options correspond to settings in the [Sleep] section of sleep.conf.
 * See sleep.conf(5) for detailed descriptions of each option.
 */
export type SleepConf = {
  Sleep: {
    /**
     * Default sleep mode for "suspend" action.
     * Can be a space-separated list for fallback modes.
     */
    SuspendMode?: string;

    /**
     * Default sleep mode for "hibernate" action.
     */
    HibernateMode?: string;

    /**
     * Default sleep mode for "hybrid-sleep" action.
     */
    HybridSleepMode?: string;

    /**
     * Power state to enter for suspend.
     * Common values: "mem", "standby", "freeze".
     */
    SuspendState?: string;

    /**
     * Power state to enter for hibernate.
     * Typically "disk".
     */
    HibernateState?: string;

    /**
     * Power state to enter for hybrid sleep.
     */
    HybridSleepState?: string;

    /**
     * Delay before hibernating in suspend-then-hibernate mode.
     * After this delay, system transitions from suspend to hibernate.
     */
    HibernateDelaySec?: number | string;

    /**
     * Interval for estimating suspend duration for battery savings.
     * Used in suspend-then-hibernate mode.
     */
    SuspendEstimationSec?: number | string;
  };
};
