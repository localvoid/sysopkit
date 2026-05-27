/**
 * @module systemd/coredump
 *
 * systemd-coredump configuration management.
 *
 * @see coredump.conf(5) - Core dump storage configuration files
 *
 * Configuration is written to a drop-in file at:
 * /etc/systemd/coredump.conf.d/sysops.conf
 */

/**
 * Options for configuring systemd-coredump.
 *
 * All options correspond to settings in the [Coredump] section of coredump.conf.
 * See coredump.conf(5) for detailed descriptions of each option.
 */
export type CoredumpConf = {
  Coredump: {
    /**
     * Where to store core dumps.
     * - "none": Log but don't store cores
     * - "external": Store in /var/lib/systemd/coredump/ (default)
     * - "journal": Store in the journal
     * - "auto": External with journal fallback
     */
    Storage?: 'none' | 'external' | 'journal' | 'auto';

    /**
     * Enable compression for externally stored cores.
     * Default: yes.
     */
    Compress?: 'yes' | 'no';

    /**
     * Maximum size of a core to process (generate stack trace).
     * Cores exceeding this may still be stored. Default: 2G on 64-bit.
     * Use suffixes K, M, G, T, P, E (base 1024).
     */
    ProcessSizeMax?: string;

    /**
     * Maximum size of a core to save to external storage.
     * Default: 2G on 64-bit. Use "infinity" for unlimited.
     */
    ExternalSizeMax?: string;

    /**
     * Maximum size of a core to save in the journal.
     * Default: 767M (hard limit imposed by journal).
     */
    JournalSizeMax?: string;

    /**
     * Maximum disk space for externally stored cores.
     * Old cores are removed when exceeded. Default: 10% of disk.
     */
    MaxUse?: string;

    /**
     * Minimum disk space to keep free.
     * Default: 15% of disk.
     */
    KeepFree?: string;

    /**
     * Whether to enter namespaces to access debug info from crashed process.
     * This allows generating fully symbolized backtraces for containerized
     * processes, but may have security implications.
     * Default: no.
     */
    EnterNamespace?: 'yes' | 'no';
  };
};
