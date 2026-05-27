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
     * - true: Enable full responder and resolver
     * - false: Disable LLMNR
     * - "resolve": Enable resolver only, no responding
     */
    LLMNR?: 'yes' | 'no' | 'resolve';

    /**
     * Multicast DNS support.
     * - true: Enable full responder and resolver
     * - false: Disable Multicast DNS
     * - "resolve": Enable resolver only, no responding
     */
    MulticastDNS?: 'yes' | 'no' | 'resolve';

    /**
     * DNS-over-TLS mode.
     * - true: Require TLS for all DNS connections
     * - false: No TLS, use UDP
     * - "opportunistic": Try TLS, fall back to UDP if not supported
     */
    DNSOverTLS?: 'yes' | 'no' | 'opportunistic';

    /**
     * DNSSEC validation mode.
     * - true: Require DNSSEC validation
     * - false: Disable DNSSEC validation
     * - "allow-downgrade": Attempt DNSSEC, disable if server doesn't support
     */
    DNSSEC?: 'yes' | 'no' | 'allow-downgrade';

    /**
     * DNS caching behavior.
     * - true: Enable full caching (default)
     * - false: Disable caching
     * - "no-negative": Cache only positive answers
     */
    Cache?: 'yes' | 'no' | 'no-negative';

    /**
     * Whether to cache responses from localhost DNS servers.
     * Default: false (don't cache localhost responses).
     */
    CacheFromLocalhost?: 'yes' | 'no';

    /**
     * DNS stub listener mode.
     * - true: Listen on both UDP and TCP (default)
     * - false: Disable stub listener
     * - "udp": Listen on UDP only
     * - "tcp": Listen on TCP only
     */
    DNSStubListener?: 'yes' | 'no' | 'udp' | 'tcp';

    /**
     * Additional addresses for the DNS stub listener.
     * Format: [protocol:]address[:port]
     * Examples: "192.168.1.1", "[::1]:5353", "tcp:10.0.0.1:53"
     */
    DNSStubListenerExtra?: string;

    /**
     * Whether to read /etc/hosts for name resolution.
     * Default: true.
     */
    ReadEtcHosts?: 'yes' | 'no';

    /**
     * Whether to resolve single-label names via global DNS servers.
     * Default: false (not recommended for privacy reasons).
     * @see https://www.iab.org/documents/correspondence-reports-documents/2013-2/iab-statement-dotless-domains-considered-harmful/
     */
    ResolveUnicastSingleLabel?: 'yes' | 'no';

    /**
     * How long to retain stale DNS records beyond their TTL.
     * Useful for resilience during DNS server outages.
     * Default: 0 (disabled).
     */
    staleRetentionSec?: string;
  };
};

/**
 * Options for per-link resolved configuration.
 * Configuration files at /etc/systemd/resolved.conf.d/{ifname}.conf
 * with per-link DNS settings. This is useful for interfaces that need
 * specific DNS servers or search domains.
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
