/**
 * @module systemd/timesyncd
 *
 * systemd-timesyncd configuration management.
 *
 * @see timesyncd.conf(5) - Network Time Synchronization configuration files
 */

export const TIMESYNCD_CONF_PATH = '/etc/systemd/timesyncd.conf';

/**
 * Options for configuring systemd-timesyncd.
 *
 * All options correspond to settings in the [Time] section of timesyncd.conf.
 * See timesyncd.conf(5) for detailed descriptions of each option.
 */
export type TimesyncdConf = {
  Time: {
    /**
     * Space-separated list of NTP server hostnames or IP addresses.
     * Combined with per-interface servers from networkd.
     * Assign empty string to reset the list.
     */
    NTP?: string | string[];

    /**
     * Fallback NTP servers used when no other NTP information is available.
     * If not specified, a compiled-in list is used.
     */
    FallbackNTP?: string | string[];

    /**
     * Maximum acceptable root distance.
     * Accepts a time span (e.g., "5s").
     * Timesyncd will switch servers if current server exceeds this.
     * Default: 5 seconds.
     */
    RootDistanceMaxSec?: number | string;

    /**
     * Minimum poll interval for NTP messages.
     * Accepts a time span. Default: 32 seconds. Minimum: 16 seconds.
     */
    PollIntervalMinSec?: number | string;

    /**
     * Maximum poll interval for NTP messages.
     * Accepts a time span. Default: 2048 seconds (34 min 8 sec).
     */
    PollIntervalMaxSec?: number | string;

    /**
     * Minimum delay before retrying to contact a new NTP server.
     * Accepts a time span. Default: 30 seconds. Minimum: 1 second.
     */
    ConnectionRetrySec?: number | string;

    /**
     * Interval for saving current time to disk when not synchronized.
     * Accepts a time span. Useful for offline systems without RTC
     * to maintain clock monotonicity. Default: 60 seconds.
     */
    SaveIntervalSec?: number | string;
  };
};
