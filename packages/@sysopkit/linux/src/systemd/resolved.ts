/**
 * @module systemd/resolved
 *
 * systemd-resolved configuration management.
 *
 * @see resolved.conf(5) - Network Name Resolution configuration files
 *
 * Configuration is written to a drop-in file at:
 * /etc/systemd/resolved.conf.d/sysops.conf
 */

export const RESOLVED_CONF_PATH = '/etc/systemd/resolved.conf';

/**
 * Options for configuring systemd-resolved.
 *
 * All options correspond to settings in the [Resolve] section of resolved.conf.
 * See resolved.conf(5) for detailed descriptions of each option.
 */
export type ResolvedConf = {
  Resolve: {
    /**
     * Space-separated list of IPv4/IPv6 addresses to use as DNS servers.
     * Each address can optionally include:
     * - Port number (e.g., "1.2.3.4:5353")
     * - Interface name (e.g., "1.2.3.4%eth0")
     * - SNI hostname (e.g., "1.2.3.4#dns.example.com")
     */
    DNS?: string;

    /**
     * Fallback DNS servers used when no other DNS information is available.
     */
    FallbackDNS?: string;

    /**
     * Search domains for single-label hostname resolution.
     * Domains prefixed with "~" are route-only domains (no search suffix).
     */
    Domains?: string;

    /**
     * Link-Local Multicast Name Resolution (LLMNR) support.
     * - "yes": Enable full responder and resolver
     * - "no": Disable LLMNR
     * - "resolve": Enable resolver only, no responding
     */
    LLMNR?: 'yes' | 'no' | 'resolve';

    /**
     * Multicast DNS support.
     * - "yes": Enable full responder and resolver
     * - "no": Disable Multicast DNS
     * - "resolve": Enable resolver only, no responding
     */
    MulticastDNS?: 'yes' | 'no' | 'resolve';

    /**
     * DNS-over-TLS mode.
     * - "yes": Require TLS for all DNS connections
     * - "no": No TLS, use UDP
     * - "opportunistic": Try TLS, fall back to UDP if not supported
     * Default: no.
     */
    DNSOverTLS?: 'yes' | 'no' | 'opportunistic';

    /**
     * DNSSEC validation mode.
     * - "yes": Require DNSSEC validation
     * - "no": Disable DNSSEC validation
     * - "allow-downgrade": Attempt DNSSEC, disable if server doesn't support
     * Default: no.
     */
    DNSSEC?: 'yes' | 'no' | 'allow-downgrade';

    /**
     * DNS caching behavior.
     * - "yes": Enable full caching (default)
     * - "no": Disable caching
     * - "no-negative": Cache only positive answers
     */
    Cache?: 'yes' | 'no' | 'no-negative';

    /**
     * Whether to cache responses from localhost DNS servers.
     * Default: no (don't cache localhost responses).
     */
    CacheFromLocalhost?: 'yes' | 'no';

    /**
     * DNS stub listener mode.
     * - "yes": Listen on both UDP and TCP (default)
     * - "no": Disable stub listener
     * - "udp": Listen on UDP only
     * - "tcp": Listen on TCP only
     */
    DNSStubListener?: 'yes' | 'no' | 'udp' | 'tcp';

    /**
     * Space-separated list of DNS record types to refuse.
     * Example: "AAAA SRV TXT".
     */
    RefuseRecordTypes?: string;

    /**
     * Additional addresses for the DNS stub listener.
     * Format: [protocol:]address[:port]
     * Examples: "192.168.1.1", "[::1]:5353", "tcp:10.0.0.1:53"
     */
    DNSStubListenerExtra?: string;

    /**
     * Whether to read /etc/hosts for name resolution.
     * Default: yes.
     */
    ReadEtcHosts?: 'yes' | 'no';

    /**
     * Whether to resolve single-label names via global DNS servers.
     * Default: no (not recommended for privacy reasons).
     * @see https://www.iab.org/documents/correspondence-reports-documents/2013-2/iab-statement-dotless-domains-considered-harmful/
     */
    ResolveUnicastSingleLabel?: 'yes' | 'no';

    /**
     * How long to retain stale DNS records beyond their TTL.
     * Takes a duration value. Useful for resilience during DNS outages.
     * Default: 0 (disabled).
     */
    StaleRetentionSec?: number | string;
  };
};

/**
 * Options for per-link resolved configuration via systemd-networkd.
 *
 * Per-link DNS settings (DNS=, Domains=, LLMNR=, MulticastDNS=,
 * DNSOverTLS=, DNSSEC=) are configured in .network files, see
 * systemd-networkd.service(8) and systemd.network(5), not in
 * resolved.conf.d/. This type mirrors the subset of [Resolve] keys
 * that networkd accepts per link.
 */
export type ResolvedLinkConf = {
  Resolve: {
    /** DNS servers specific to this interface. */
    DNS?: string;

    /** Search/route domains for this interface. */
    Domains?: string;

    /** LLMNR setting for this interface. */
    LLMNR?: 'yes' | 'no' | 'resolve';

    /** Multicast DNS setting for this interface. */
    MulticastDNS?: 'yes' | 'no' | 'resolve';

    /** DNS-over-TLS setting for this interface. */
    DNSOverTLS?: 'yes' | 'no' | 'opportunistic';

    /** DNSSEC setting for this interface. */
    DNSSEC?: 'yes' | 'no' | 'allow-downgrade';
  };
};
