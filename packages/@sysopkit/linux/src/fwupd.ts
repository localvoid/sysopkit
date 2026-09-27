/**
 * @module fwupd
 *
 * fwupd daemon configuration management.
 *
 * @see fwupd.conf(5) - configuration file for the fwupd daemon
 *
 * Configuration is written to:
 * /etc/fwupd/fwupd.conf
 */

export const FWUPD_CONF_PATH = '/etc/fwupd/fwupd.conf';

/**
 * Options for configuring the fwupd daemon.
 *
 * All options correspond to settings in the [fwupd] section of fwupd.conf.
 * See fwupd.conf(5) for detailed descriptions of each option.
 */
export type FwupdConf = {
  fwupd: {
    /**
     * Block specific devices by their GUID, using semicolons as delimiter.
     */
    DisabledDevices?: string;

    /**
     * Block specific plugins by name.
     * Use `fwupdmgr get-plugins` to get the list of plugins.
     */
    DisabledPlugins?: string;

    /**
     * Maximum archive size that can be loaded in Mb.
     * Default is 25% of the total system memory.
     */
    ArchiveSizeMax?: number;

    /**
     * Idle time in seconds to shut down the daemon.
     * A value of 0 specifies "never". Default: 300.
     *
     * NOTE: some plugins might inhibit the auto-shutdown, for instance thunderbolt.
     */
    IdleTimeout?: number;

    /**
     * If the daemon takes more than this time to startup (in milliseconds)
     * then inhibit the idle shutdown timer. A value of 0 specifies "never".
     * Default: 500.
     */
    IdleInhibitStartupThreshold?: number;

    /**
     * Comma separated list of domains to log in verbose mode.
     * If unset, no domains are set to verbose. If set to "*", all domains
     * are verbose, which is the same as running the daemon with
     * --verbose --verbose.
     */
    VerboseDomains?: string;

    /**
     * Update the message of the day (MOTD) on device and metadata changes.
     * Default: "true".
     */
    UpdateMotd?: 'true' | 'false';

    /**
     * For some plugins, enumerate only devices supported by metadata.
     * Default: "false".
     */
    EnumerateAllDevices?: 'true' | 'false';

    /**
     * A list of firmware checksums that has been approved by the site admin.
     * If unset, all firmware is approved.
     */
    ApprovedFirmware?: string;

    /**
     * Allowed URI schemes in the preference order; failed downloads from the
     * first scheme will be retried with the next in order until no choices remain.
     * Default: "file;https;http;ipfs".
     */
    UriSchemes?: string;

    /**
     * Ignore power levels of devices when running updates.
     * Default: "false".
     */
    IgnorePower?: 'true' | 'false';

    /**
     * Ignore some device requirements, for instance removing the generic GUID
     * requirement of a CHID, child, parent or sibling. This is not recommended
     * for production systems, although it may be useful for firmware development.
     * Default: "false".
     */
    IgnoreRequirements?: 'true' | 'false';

    /**
     * Ignore the efivars free space requirement for db, dbx, KEK and PK updates.
     * This may be required on Linux kernels older than 6.4, or where the hardware
     * does not support UEFI RT->QueryVariableInfo.
     * Default: "false".
     */
    IgnoreEfivarsFreeSpace?: 'true' | 'false';

    /**
     * Only trust post-quantum cryptographic signatures. This is only recommended
     * when you are sure the firmware contains a valid PQ signature.
     * Default: "false".
     */
    OnlyTrustPostQuantumSignatures?: 'true' | 'false';

    /**
     * Only support installing firmware signed with a trusted key.
     * Do not set this to false on a production or trusted system.
     * Default: "true".
     */
    OnlyTrusted?: 'true' | 'false';

    /**
     * Show data such as device serial numbers which some users may consider private.
     * Default: "true".
     */
    ShowDevicePrivate?: 'true' | 'false';

    /**
     * UIDs matching these values that call the D-Bus interface should be
     * marked as trusted.
     */
    TrustedUids?: string;

    /**
     * Comma separated list of best known configuration IDs to be used when using
     * `fwupdmgr sync`. This can downgrade firmware to factory versions or upgrade
     * firmware to a supported config level.
     * Example: "vendor-factory-2021q1,mycompany-2023".
     */
    HostBkc?: string;

    /**
     * Deduplicate duplicate releases by the archive checksum when available
     * from more than one source.
     * Default: "true".
     */
    ReleaseDedupe?: 'true' | 'false';

    /**
     * When the same version release is available from more than one source this
     * option can be used to either prefer the local version (avoiding a
     * potentially expensive download) or to prefer the remote version (which may
     * have updated metadata such as release notes).
     * Omit to not make any adjustment to the policy, relying on the OrderAfter
     * and OrderBefore sections in the remote.
     * Default: "local".
     */
    ReleasePriority?: 'local' | 'remote';

    /**
     * Set the preferred location used for the EFI system partition (ESP) path.
     * This is typically used if UDisks was not able to automatically identify
     * the location for any reason.
     */
    EspLocation?: string;

    /**
     * Don't allow fwupd plugins to directly interact with devices during probe
     * or setup stages. The kernel should provide all device information in sysfs
     * files or udev properties. This will block some plugins from working.
     * Default: "false".
     */
    RequireImmutableEnumeration?: 'true' | 'false';

    /**
     * Override values for SMBIOS or Device Tree data on the local system. These are
     * only required when the SMBIOS or Device Tree data is invalid, missing, or to
     * simulate running on another system. Empty values should be used to populate
     * blank entries or add values to populate specific entries.
     */
    Manufacturer?: string;

    /**
     * Override values for SMBIOS or Device Tree data on the local system.
     * @see Manufacturer for details.
     */
    ProductName?: string;

    /**
     * Override values for SMBIOS or Device Tree data on the local system.
     * @see Manufacturer for details.
     */
    ProductSku?: string;

    /**
     * Override values for SMBIOS or Device Tree data on the local system.
     * @see Manufacturer for details.
     */
    Family?: string;

    /**
     * Override values for SMBIOS or Device Tree data on the local system.
     * @see Manufacturer for details.
     */
    EnclosureKind?: string;

    /**
     * Override values for SMBIOS or Device Tree data on the local system.
     * @see Manufacturer for details.
     */
    BaseboardProduct?: string;

    /**
     * Override values for SMBIOS or Device Tree data on the local system.
     * @see Manufacturer for details.
     */
    BaseboardManufacturer?: string;

    /**
     * Vendor reports matching these expressions will have releases marked as
     * trusted-report. Each OR section is delimited by a ";" and each AND section
     * delimited by "&".
     * Example: "DistroId=fedora&VendorId=$OEM".
     * A VendorId of $OEM represents the OEM vendor ID of the vendor that owns
     * the firmware. The os-release values $ID, $VERSION_ID and $VARIANT_ID are
     * also available, e.g. "DistroId=$ID".
     * Default: "VendorId=$OEM".
     */
    TrustedReports?: string;

    /**
     * Peer-to-peer policy for the daemon, e.g. using Passim, an optional local
     * caching service. Using peer-to-peer data might reduce the amount of
     * bandwidth used on your network considerably.
     * - "nothing": Do not publish any files
     * - "metadata": Only publish shared metadata that is common to each machine
     * - "firmware": Only publish firmware archives after the next reboot
     * Default: "metadata".
     */
    P2pPolicy?: 'nothing' | 'metadata' | 'firmware' | 'metadata,firmware';

    /**
     * Create virtual test devices and remote for validating daemon flows.
     * This is only intended for CI testing and development purposes.
     * Default: "false".
     */
    TestDevices?: 'true' | 'false';
  };
};
