/**
 * @module iwd
 *
 * iwd wireless daemon configuration management.
 *
 * @see iwd.config(5) - Configuration file for wireless daemon (`main.conf`)
 * @see iwd.network(5) - Network configuration for wireless daemon
 * (`.open` / `.psk` / `.8021x` files)
 *
 * System-wide settings live in `main.conf` (see `IWD_MAIN_CONF_PATH`;
 * absent by default, in which case iwd uses built-in defaults). Known
 * networks live in the state directory (see `IWD_NETWORK_DIR`), one file
 * per SSID and security type — see `getIwdNetworkPath()`.
 *
 * Serialize with `serializeIni` from `sysopkit/op/ini`. Note that iwd's
 * keyfile syntax backslash-escapes `space`, `\t`, `\r`, `\n` and `\`
 * itself (a leading space is written as `\s`), which `serializeIni`
 * does not do — pre-escape values that need it.
 *
 * Embedded PEMs (`[@pem@<name>]` groups referenced as `embed:<name>`,
 * e.g. `EAP-TLS-CACert=embed:my_ca_cert`) are raw multi-line payloads,
 * not key/value pairs, so they cannot be produced by `serializeIni` —
 * append them to the serialized output manually.
 */

export const IWD_MAIN_CONF_PATH = '/etc/iwd/main.conf';
export const IWD_NETWORK_DIR = '/var/lib/iwd';

/**
 * Network security type, determining the network file suffix.
 * @see iwd.network(5) NAMING
 */
export type IwdNetworkSecurityType = 'open' | 'psk' | '8021x';

const SSID_VERBATIM = /^[A-Za-z0-9 _-]+$/;
const HEX = '0123456789abcdef';
const UTF8 = new TextEncoder();

/**
 * Encodes an SSID into the file-name-safe form used for iwd network files.
 *
 * Names containing only alphanumerics, spaces, underscores or minus signs
 * appear verbatim; anything else is encoded as `=` followed by the
 * lowercase hex of the UTF-8 bytes.
 *
 * @see iwd.network(5) NAMING
 */
export function encodeIwdSsid(ssid: string): string {
  if (SSID_VERBATIM.test(ssid)) {
    return ssid;
  }
  const bytes = UTF8.encode(ssid);
  let hex = '=';
  for (const byte of bytes) {
    hex += HEX[(byte >> 4) & 0xf];
    hex += HEX[byte & 0xf];
  }
  return hex;
}

/**
 * Returns the full path of the iwd network file for an SSID.
 *
 * @param ssid - Network SSID (unencoded)
 * @param security - Security type selecting the `.open` / `.psk` / `.8021x`
 * suffix
 * @see iwd.network(5) NAMING
 */
export function getIwdNetworkPath(ssid: string, security: IwdNetworkSecurityType): string {
  return `${IWD_NETWORK_DIR}/${encodeIwdSsid(ssid)}.${security}`;
}

/**
 * EAP authentication methods accepted by `EAP-Method`.
 * `GTC` and `MD5` are only valid as `TTLS`/`PEAP` inner methods.
 *
 * @see iwd.network(5) Network Authentication Settings
 */
export type IwdEapMethod =
  | 'AKA'
  | "AKA'"
  | 'MSCHAPV2'
  | 'PEAP'
  | 'PWD'
  | 'SIM'
  | 'TLS'
  | 'TTLS'
  | 'GTC'
  | 'MD5';

/** mDNS mode for a known network. */
export type IwdMulticastDns = 'true' | 'false' | 'resolve';

/**
 * Options for the iwd daemon (`main.conf`).
 *
 * Every section is optional; when `main.conf` is absent iwd uses
 * built-in defaults. See iwd.config(5) for detailed descriptions.
 */
export type IwdMainConf = {
  General?: {
    /**
     * Enable network configuration (IP addresses via static files or the
     * built-in DHCP client, plus DHCP server in AP mode).
     * Disabled by default.
     */
    EnableNetworkConfiguration?: 'true' | 'false';

    /**
     * Do not destroy/recreate wireless interfaces at startup.
     * @deprecated Use `DriverQuirks.DefaultInterface` instead.
     */
    UseDefaultInterface?: 'true' | 'false';

    /**
     * MAC address randomization policy.
     * - "disabled": kernel default (permanent address, trackable)
     * - "once": randomized once at startup/first detection
     * - "network": randomized per network (derived from SSID + address)
     */
    AddressRandomization?: 'disabled' | 'once' | 'network';

    /**
     * Which octets to randomize: "nic" randomizes only the last 3 octets
     * (00:00:01–00:00:FE range), "full" randomizes all 6 and sets the
     * locally-administered bit.
     */
    AddressRandomizationRange?: 'full' | 'nic';

    /**
     * RSSI threshold (dBm, -100 to 1, default -70) controlling roam
     * aggressiveness on 2.4GHz.
     */
    RoamThreshold?: number;

    /**
     * RSSI threshold (dBm, -100 to 1, default -76) controlling roam
     * aggressiveness on 5GHz.
     */
    RoamThreshold5G?: number;

    /**
     * RSSI threshold (dBm, -100 to -1, default -80) at which iwd roams
     * regardless of BSS affinity on 2.4GHz.
     */
    CriticalRoamThreshold?: number;

    /**
     * Same as `CriticalRoamThreshold` for the 5GHz band (default -82).
     */
    CriticalRoamThreshold5G?: number;

    /**
     * Seconds to wait before retrying a failed roam or roaming away from
     * a still-weak BSS. Default: 60.
     */
    RoamRetryInterval?: number;

    /**
     * Management Frame Protection: 0 disables MFP (not recommended),
     * 1 enables when both sides support it, 2 always requires it.
     */
    ManagementFrameProtection?: 0 | 1 | 2;

    /**
     * Send EAPoL packets over NL80211 instead of the Ethernet device.
     * Enabled by default when the kernel supports it.
     */
    ControlPortOverNL80211?: 'true' | 'false';

    /**
     * Disable ANQP queries (needed for Hotspot 2.0; requires kernel 5.3+,
     * some drivers misbehave). Disabled by default — set to "false" to
     * use Hotspot 2.0 networks.
     */
    DisableANQP?: 'true' | 'false';

    /**
     * Disable Operating Channel Validation (for kernels/drivers without
     * OCV support).
     */
    DisableOCV?: 'true' | 'false';

    /**
     * Systemd credential ID used to encrypt PSK/802.1x profiles.
     * Highly experimental: encryption is one-way via iwd alone
     * (decrypt with `iwd-decrypt-profile`).
     */
    SystemdEncrypt?: string;

    /**
     * ISO Alpha-2 country code regulatory hint (not guaranteed to apply;
     * never applies to self-managed wiphys).
     */
    Country?: string;

    /** Disable PMKSA support. */
    DisablePMKSA?: 'true' | 'false';
  };

  Network?: {
    /**
     * Whether iwd configures IPv6 addresses/routes (static, RA or DHCPv6).
     * Enabled by default; overridable per network via `[IPv6].Enabled`.
     */
    EnableIPv6?: 'true' | 'false';

    /**
     * DNS integration, used with `EnableNetworkConfiguration`.
     * Default: "systemd".
     */
    NameResolvingService?: 'resolvconf' | 'systemd' | 'none';

    /**
     * Route priority offset for default routes (lower wins).
     * Default: 300.
     */
    RoutePriorityOffset?: number;
  };

  Blacklist?: {
    /**
     * Seconds a misbehaving BSS spends on the blacklist.
     * Default: 60. Zero disables blacklisting.
     */
    InitialTimeout?: number;

    /**
     * Seconds a BSS stays blacklisted after refusing connections
     * (`NO_MORE_STAS` / BSS transition request). Default: 30.
     */
    InitialAccessPointBusyTimeout?: number;

    /**
     * @deprecated Use `InitialAccessPointBusyTimeout` instead.
     */
    InitialRoamRequestedTimeout?: number;

    /**
     * Backoff multiplier extending the blacklist on repeated failures.
     * Default: 30.
     */
    Multiplier?: number;

    /**
     * Maximum seconds a BSS stays blacklisted. Default: 86400.
     */
    MaximumTimeout?: number;
  };

  Rank?: {
    /**
     * Preference modifier for 2.4GHz access points (default 1.0).
     * 0.0 disables the band (no scanning/connecting).
     */
    BandModifier2_4GHz?: number;

    /**
     * Preference modifier for 5GHz access points (default 1.0).
     * 0.0 disables the band.
     */
    BandModifier5GHz?: number;

    /**
     * Preference modifier for 6GHz access points (default 1.0).
     * 0.0 disables the band.
     */
    BandModifier6GHz?: number;

    /**
     * Experimental. BSS utilization (0–255) above which an exponentially
     * decaying rank penalty applies. Default: 0 (disabled).
     */
    HighUtilizationThreshold?: number;

    /**
     * Experimental. BSS station count (0–255) above which an exponentially
     * decaying rank penalty applies. Default: 0 (disabled).
     */
    HighStationCountThreshold?: number;
  };

  Scan?: {
    /**
     * Disable periodic scans for available networks while disconnected
     * (user-initiated scans unaffected). Enabled by default.
     */
    DisablePeriodicScan?: 'true' | 'false';

    /** Initial periodic scan interval in seconds. Default: 10. */
    InitialPeriodicScanInterval?: number;

    /** Maximum periodic scan interval in seconds. Default: 300. */
    MaximumPeriodicScanInterval?: number;

    /**
     * Disable roaming scans (may prevent proper roaming; useful on
     * extremely low-RSSI networks where roaming is impossible).
     */
    DisableRoamingScan?: 'true' | 'false';
  };

  IPv4?: {
    /**
     * Comma-separated prefix-notation IP space for AP-mode subnets and
     * the DHCP server. Default: "192.168.0.0/16". Overridable per AP
     * profile via `[IPv4].Address`.
     */
    APAddressPool?: string;
  };

  DriverQuirks?: {
    /**
     * Comma-separated drivers/globs for which iwd keeps the default
     * interface instead of removing/recreating it.
     */
    DefaultInterface?: string;

    /**
     * Comma-separated drivers/globs forced onto PAE instead of
     * `ControlPortOverNL80211`.
     */
    ForcePae?: string;

    /** Comma-separated drivers/globs with power save disabled. */
    PowerSaveDisable?: string;

    /** Comma-separated drivers/globs with multicast RX disabled. */
    MulticastRxDisable?: string;

    /**
     * Comma-separated drivers/globs with SAE/WPA3 disabled (WPA3-only
     * networks become unreachable; hybrid networks use WPA2).
     */
    SaeDisable?: string;
  };
};

/**
 * Known-network configuration (`.psk` files; also covers the shared
 * `[Settings]` / `[Network]` / `[IPv4]` / `[IPv6]` groups of `.open`
 * and `.8021x` files).
 *
 * The `[Security]` group may alternatively hold only `EncryptedSalt` /
 * `EncryptedSecurity` when profile encryption (`SystemdEncrypt`) is
 * enabled — do not modify encrypted sections.
 *
 * See iwd.network(5) for detailed descriptions.
 */
export type IwdPskConf = {
  Settings?: {
    /** Whether the network can be connected to automatically. */
    AutoConnect?: 'true' | 'false';

    /** Whether the SSID must be included in active scan requests. */
    Hidden?: 'true' | 'false';

    /**
     * Fully randomize the MAC on each connection. Only used when
     * `[General].AddressRandomization` is "network". Ignored when
     * `AddressOverride` is set.
     */
    AlwaysRandomizeAddress?: 'true' | 'false';

    /**
     * MAC address override for this network. Only used when
     * `[General].AddressRandomization` is "network". Takes precedence
     * over `AlwaysRandomizeAddress`.
     */
    AddressOverride?: string;

    /**
     * Disallow TKIP pairwise ciphers and connections without Management
     * Frame Protection. Normally updated automatically via Transition
     * Disable indications; manual changes rarely needed.
     */
    TransitionDisable?: 'true' | 'false';

    /**
     * Comma-separated list of disabled transition modes: "personal",
     * "enterprise", "open" (e.g. disabling "personal" restricts the
     * network to WPA3-Personal APs).
     */
    DisabledTransitionModes?: string;

    /**
     * Force the default ECC group (19) for ECC protocols (WPA3, OWE).
     * When unset iwd learns the network's capabilities on first
     * association.
     */
    UseDefaultEccGroup?: 'true' | 'false';
  };

  Security?: {
    /**
     * 8–63 character passphrase for WPA-Personal (required for
     * WPA3-Personal/SAE unless `PreSharedKey` is given; otherwise the
     * agent is asked at connection time).
     */
    'Passphrase'?: string;

    /** Identifier string used with the passphrase on SAE networks. */
    'PasswordIdentifier'?: string;

    /**
     * 64-char hex pre-shared key. Must be provided when `Passphrase`
     * is omitted.
     */
    'PreSharedKey'?: string;

    /**
     * Outer EAP method for WPA-Enterprise. `GTC`/`MD5` are only valid
     * as inner methods.
     */
    'EAP-Method'?: IwdEapMethod | (string & {});

    /**
     * Plaintext identity. Required by GTC, MD5, MSCHAPV2, PWD (agent is
     * asked when missing); TLS-based methods may still need it depending
     * on the RADIUS server.
     */
    'EAP-Identity'?: string;

    /**
     * Password for WPA-Enterprise authentication (agent is asked when
     * missing). Required by: GTC, MD5, MSCHAPV2, PWD.
     */
    'EAP-Password'?: string;

    /**
     * Pre-hashed password (e.g. MD4 hash for MSCHAPV2) in hex.
     */
    'EAP-Password-Hash'?: string;

    /** PEM CA bundle path (or `embed:<name>`) for EAP-TLS trust. */
    'EAP-TLS-CACert'?: string;

    /** PEM CA bundle path (or `embed:<name>`) for EAP-TTLS trust. */
    'EAP-TTLS-CACert'?: string;

    /** PEM CA bundle path (or `embed:<name>`) for EAP-PEAP trust. */
    'EAP-PEAP-CACert'?: string;

    /** Client certificate/chain path (or `embed:<name>`) for EAP-TLS. */
    'EAP-TLS-ClientCert'?: string;

    /**
     * Client private key path (or `embed:<name>`) for EAP-TLS
     * (PKCS#8 PEM recommended).
     */
    'EAP-TLS-ClientKey'?: string;

    /**
     * Container file (PKCS#12 recommended) holding both the client
     * certificate and private key — alternative to `EAP-TLS-ClientCert`
     * + `EAP-TLS-ClientKey`.
     */
    'EAP-TLS-ClientKeyBundle'?: string;

    /**
     * Decryption passphrase for encrypted client key/certificate files
     * (agent is asked when missing).
     */
    'EAP-TLS-ClientKeyPassphrase'?: string;

    /**
     * Semicolon-separated domain masks the EAP-TLS server certificate
     * must match (`*` segment matches any single label, leading `*`
     * matches one or more leading labels).
     */
    'EAP-TLS-ServerDomainMask'?: string;

    /** Same as `EAP-TLS-ServerDomainMask` for EAP-TTLS. */
    'EAP-TTLS-ServerDomainMask'?: string;

    /** Same as `EAP-TLS-ServerDomainMask` for EAP-PEAP. */
    'EAP-PEAP-ServerDomainMask'?: string;

    /**
     * Whether to cache TLS sessions for faster EAP-TLS reconnection.
     * Disable when every other connection attempt fails (misconfigured
     * authenticator accepting then dropping resumption).
     */
    'EAP-TLS-FastReauthentication'?: 'true' | 'false';

    /** Same as `EAP-TLS-FastReauthentication` for EAP-TTLS. */
    'EAP-TTLS-FastReauthentication'?: 'true' | 'false';

    /** Same as `EAP-TLS-FastReauthentication` for EAP-PEAP. */
    'EAP-PEAP-FastReauthentication'?: 'true' | 'false';

    /**
     * Phase 2 method for EAP-TTLS: `Tunneled-CHAP`, `Tunneled-MSCHAP`,
     * `Tunneled-MSCHAPv2`, `Tunneled-PAP`, or an EAP method name.
     */
    'EAP-TTLS-Phase2-Method'?: string;

    /** Username for the TTLS non-EAP Phase 2 methods. */
    'EAP-TTLS-Phase2-Identity'?: string;

    /** Password for the TTLS non-EAP Phase 2 methods. */
    'EAP-TTLS-Phase2-Password'?: string;

    /**
     * Inner EAP method for EAP-PEAP (an EAP method name, e.g. "MSCHAPV2").
     */
    'EAP-PEAP-Phase2-Method'?: string;

    /**
     * Inner-method settings for EAP-TTLS: same keys as the `EAP-*`
     * settings with the `EAP-TTLS-Phase2-` prefix instead of `EAP-`
     * (e.g. `EAP-TTLS-Phase2-Identity`). Negotiation is encrypted, so a
     * secure identity can be provided.
     */
    [key: `EAP-TTLS-Phase2-${string}`]: string | undefined;

    /**
     * Inner-method settings for EAP-PEAP: same keys as the `EAP-*`
     * settings with the `EAP-PEAP-Phase2-` prefix instead of `EAP-`
     * (e.g. `EAP-PEAP-Phase2-Password`).
     */
    [key: `EAP-PEAP-Phase2-${string}`]: string | undefined;

    /**
     * Salt of an encrypted profile. Present only when profile encryption
     * (`SystemdEncrypt`) is enabled — do not modify.
     */
    'EncryptedSalt'?: string;

    /**
     * Encrypted payload of an encrypted profile. Present only when
     * profile encryption (`SystemdEncrypt`) is enabled — do not modify.
     */
    'EncryptedSecurity'?: string;
  };

  Network?: {
    /**
     * mDNS for this network. When unset, systemd-resolved's default is
     * untouched. Only applies with `NameResolvingService=systemd`.
     */
    MulticastDNS?: IwdMulticastDns;
  };

  IPv4?: {
    /** Static IPv4 address (required for static configuration). */
    Address?: string;

    /** Gateway address (required for static configuration). */
    Gateway?: string;

    /**
     * Space-delimited DNS addresses (optional; overrides DHCP-provided
     * entries).
     */
    DNS?: string;

    /** Subnet address (optional; default 255.255.255.0). */
    Netmask?: string;

    /** Broadcast address (optional). */
    Broadcast?: string;

    /** Local domain name (optional; overrides the DHCP-provided value). */
    DomainName?: string;

    /** Include the hostname in DHCP requests. Disabled by default. */
    SendHostname?: 'true' | 'false';
  };

  IPv6?: {
    /**
     * Whether IPv6 is enabled for this network. When unset, the global
     * `[Network].EnableIPv6` default applies. When disabled, `disable_ipv6`
     * is set and no IPv6 addresses/routes are created.
     */
    Enabled?: 'true' | 'false';

    /**
     * Static IPv6 address (`address/prefix-length`, prefix defaults to
     * 128; required for static configuration).
     */
    Address?: string;

    /** Gateway address (required for static configuration). */
    Gateway?: string;

    /**
     * Space-delimited DNS addresses (optional; overrides DHCPv6/RA
     * entries).
     */
    DNS?: string;

    /**
     * Local domain name (optional; overrides the DHCPv6/RA value).
     */
    DomainName?: string;
  };
};
