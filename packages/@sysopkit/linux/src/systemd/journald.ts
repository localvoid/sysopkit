/**
 * @module systemd/journald
 *
 * systemd-journald configuration management.
 *
 * @see journald.conf(5) - Journal service configuration files
 *
 * Configuration is written to a drop-in file at:
 * /etc/systemd/journald.conf.d/sysops.conf
 *
 * Note: This module does not support per-namespace configuration
 * (journald@NAMESPACE.conf). Use the main journald.conf for global settings.
 */

/**
 * Options for configuring systemd-journald.
 *
 * All options correspond to settings in the [Journal] section of journald.conf.
 * See journald.conf(5) for detailed descriptions of each option.
 */
export type JournaldConf = {
  Journal: {
    /**
     * Controls where to store journal data.
     * - "volatile": Store only in memory (/run/log/journal)
     * - "persistent": Store on disk (/var/log/journal) with fallback to volatile
     * - "auto": Like persistent if /var/log/journal exists, volatile otherwise
     * - "none": Disable all storage, drop all log data
     */
    Storage?: 'volatile' | 'persistent' | 'auto' | 'none';

    /**
     * Enable compression for journal data objects larger than threshold.
     * Can also be set to a size (e.g., "1K") to specify threshold directly.
     * Default is enabled with 512 byte threshold.
     */
    Compress?: string;

    /**
     * Enable Forward Secure Sealing (FSS) for persistent journal files.
     * Requires a sealing key created via `journalctl --setup-keys`.
     */
    Seal?: 'yes' | 'no';

    /**
     * Controls whether to split journal files per user.
     * - "uid": Each user gets their own journal files (default)
     * - "none": All messages in single system journal
     * Only available for persistent storage.
     */
    SplitMode?: 'uid' | 'none';

    /**
     * Rate limit interval in seconds. Messages exceeding RateLimitBurst
     * within this interval are dropped. Default: 30s.
     */
    RateLimitIntervalSec?: number;

    /**
     * Number of messages allowed per RateLimitIntervalSec before rate limiting.
     * Default: 10000.
     */
    RateLimitBurst?: number;

    /**
     * Maximum disk space the journal may use (persistent storage).
     * Accepts size with K, M, G, T, P, E suffixes (base 1024).
     */
    SystemMaxUse?: string;

    /**
     * Disk space to keep free for other uses (persistent storage).
     * Accepts size with K, M, G, T, P, E suffixes (base 1024).
     */
    systemKeepFree?: string;

    /**
     * Maximum size of individual journal files (persistent storage).
     * Default is 1/8 of SystemMaxUse, capped at 128M.
     */
    SystemMaxFileSize?: string;

    /**
     * Maximum number of journal files to keep (persistent storage).
     * Default is 100.
     */
    SystemMaxFiles?: number;

    /**
     * Maximum disk space the journal may use (volatile/runtime storage).
     * Accepts size with K, M, G, T, P, E suffixes (base 1024).
     */
    RuntimeMaxUse?: string;

    /**
     * Disk space to keep free for other uses (volatile/runtime storage).
     * Accepts size with K, M, G, T, P, E suffixes (base 1024).
     */
    RuntimeKeepFree?: string;

    /**
     * Maximum size of individual journal files (volatile/runtime storage).
     */
    RuntimeMaxFileSize?: string;

    /**
     * Maximum number of journal files to keep (volatile/runtime storage).
     * Default is 100.
     */
    RuntimeMaxFiles?: number;

    /**
     * Maximum time to store entries in a single journal file before rotation.
     * Default: 1month. Set to 0 to disable.
     */
    MaxFileSec?: string;

    /**
     * Maximum time to store journal entries. Older entries are deleted.
     * Default: 0 (disabled).
     */
    MaxRetentionSec?: string;

    /**
     * Timeout before synchronizing journal files to disk.
     * Default: 5min. Critical messages sync immediately.
     */
    SyncIntervalSec?: number;

    /** Forward log messages to traditional syslog daemon. */
    ForwardToSyslog?: 'yes' | 'no';

    /** Forward log messages to kernel log buffer (kmsg). */
    ForwardToKMsg?: 'yes' | 'no';

    /** Forward log messages to system console. */
    ForwardToConsole?: 'yes' | 'no';

    /** Forward log messages as wall messages to all logged-in users. */
    ForwardToWall?: 'yes' | 'no';

    /**
     * Forward log messages to a socket.
     * Accepts socket address: AF_INET, AF_INET6, AF_UNIX, or AF_VSOCK.
     * Examples: "192.168.0.11:4444", "/run/host/journal/socket", "vsock:2:1234"
     */
    ForwardToSocket?: string;

    /**
     * TTY to use when ForwardToConsole=yes.
     * Default: /dev/console
     */
    TTYPath?: string;

    /**
     * Maximum line length when converting stream logs to record logs.
     * Default: 48K. Minimum accepted: 79.
     */
    LineMax?: string;

    /**
     * Maximum log level for messages stored in journal.
     * Values: "emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"
     * or integers 0-7. Default: "debug".
     */
    MaxLevelStore?: string;

    /**
     * Maximum log level for messages forwarded to syslog.
     * Default: "debug".
     */
    MaxLevelSyslog?: string;

    /**
     * Maximum log level for messages forwarded to kernel log buffer.
     * Default: "notice".
     */
    MaxLevelKMsg?: string;

    /**
     * Maximum log level for messages forwarded to console.
     * Default: "info".
     */
    MaxLevelConsole?: string;

    /**
     * Maximum log level for messages forwarded as wall messages.
     * Default: "emerg".
     */
    MaxLevelWall?: string;

    /**
     * Maximum log level for socket forwarding.
     * Default: "debug".
     */
    MaxLevelSocket?: string;

    /**
     * Process /dev/kmsg messages from kernel.
     * Default: enabled in default namespace, disabled in others.
     */
    ReadKMsg?: 'yes' | 'no';

    /**
     * Control kernel auditing.
     * - true: Enable kernel auditing
     * - false: Disable kernel auditing
     * - "keep": Leave previous state unchanged
     * Default: true in default namespace, "keep" in others.
     */
    Audit?: 'yes' | 'no' | 'keep';
  };
};
