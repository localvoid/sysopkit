/**
 * @module systemd/networkd/network
 *
 * Type definitions for systemd-networkd configuration files.
 *
 * @see systemd.network(5) - Network configuration
 */

export type NetworkConf = Partial<NetworkMatch> &
  Partial<NetworkLink> &
  Partial<NetworkSRIOV> &
  NetworkNetwork &
  Partial<NetworkAddress> &
  Partial<NetworkNeighbor> &
  Partial<NetworkIPv6AddressLabel> &
  Partial<NetworkRoutingPolicyRule> &
  Partial<NetworkNextHop> &
  Partial<NetworkRoute> &
  Partial<NetworkDHCPv4> &
  Partial<NetworkDHCPv6> &
  Partial<NetworkDHCPPrefixDelegation> &
  Partial<NetworkIPv6AcceptRA> &
  Partial<NetworkDHCPServer> &
  Partial<NetworkDHCPServerStaticLease> &
  Partial<NetworkIPv6SendRA> &
  Partial<NetworkIPv6Prefix> &
  Partial<NetworkIPv6RoutePrefix> &
  Partial<NetworkIPv6PREF64Prefix> &
  Partial<NetworkBridgePort>;

/**
 * [Match] section for .network files.
 * Determines if a given network file may be applied to a given interface.
 */
export type NetworkMatch = {
  Match: {
    /** Whitespace-separated list of hardware addresses to match. */
    MACAddress?: string;
    /** Whitespace-separated list of permanent MAC addresses to match. */
    PermanentMACAddress?: string;
    /** Whitespace-separated list of shell-style globs matching the persistent path (udev ID_PATH). */
    Path?: string;
    /** Whitespace-separated list of shell-style globs matching the driver (udev ID_NET_DRIVER). Prefix with "!" to invert. */
    Driver?: string;
    /** Whitespace-separated list of shell-style globs matching the device type. Prefix with "!" to invert. */
    Type?: string;
    /** Whitespace-separated list of shell-style globs matching the device kind. Prefix with "!" to invert. */
    Kind?: string;
    /** Whitespace-separated list of udev property names with values ("KEY=VALUE"). Prefix with "!" to invert. */
    Property?: string;
    /** Whitespace-separated list of shell-style globs matching the device name. Prefix with "!" to invert. */
    Name?: string;
    /** Whitespace-separated list of wireless network types. Prefix with "!" to invert. */
    WLANInterfaceType?:
      | 'ad-hoc'
      | 'station'
      | 'ap'
      | 'ap-vlan'
      | 'wds'
      | 'monitor'
      | 'mesh-point'
      | 'p2p-client'
      | 'p2p-go'
      | 'p2p-device'
      | 'ocb'
      | 'nan';
    /** Whitespace-separated list of shell-style globs matching the connected wireless SSID. Prefix with "!" to invert. */
    SSID?: string;
    /** Whitespace-separated list of hardware addresses of the connected wireless BSSID. */
    BSSID?: string;
    /** Matches against the hostname or machine ID. See ConditionHost= in systemd.unit(5). */
    Host?: string;
    /** Checks whether the system is in a virtualized environment. See ConditionVirtualization= in systemd.unit(5). */
    Virtualization?: string;
    /** Checks whether a specific kernel command line option is set. See ConditionKernelCommandLine= in systemd.unit(5). */
    KernelCommandLine?: string;
    /** Checks whether the kernel version matches an expression. See ConditionKernelVersion= in systemd.unit(5). */
    KernelVersion?: string;
    /** Checks whether a software version matches an expression. See ConditionVersion= in systemd.unit(5). */
    Version?: string;
    /** Checks whether the specified credential was passed to systemd-udevd.service. */
    Credential?: string;
    /** Checks whether the system is running on a specific architecture. See ConditionArchitecture= in systemd.unit(5). */
    Architecture?: string;
    /** Checks whether the system is running on a machine with the specified firmware. See ConditionFirmware= in systemd.unit(5). */
    Firmware?: string;
  };
};

/**
 * [Link] section for .network files.
 * Configures link-level settings for the interface.
 */
export type NetworkLink = {
  Link: {
    /** The hardware address to set for the device. */
    MACAddress?: string;
    /** The maximum transmission unit in bytes. Suffixes K, M, G supported (base 1024). */
    MTUBytes?: string;
    /** Enable IPv4 ARP and IPv6 NDP for this interface. */
    ARP?: 'on' | 'off';
    /** Enable the multicast flag on the device. */
    Multicast?: 'on' | 'off';
    /** Enable retrieval of all multicast packets from the network. */
    AllMulticast?: 'on' | 'off';
    /** Enable promiscuous mode of the interface. */
    Promiscuous?: 'on' | 'off';
    /** When true, no attempts are made to bring up or configure matching links. */
    Unmanaged?: 'on' | 'off';
    /** Link group number (0-2147483647). Similar to port ranges on managed switches. */
    Group?: number;
    /** Whether the network is required for online determination. Takes 'on' | 'off', minimum state, or state range. */
    RequiredForOnline?: string;
    /** Address family required for online determination. Only effective when RequiredForOnline is not "no". */
    RequiredFamilyForOnline?: 'ipv4' | 'ipv6' | 'both' | 'any';
    /** Policy for managing the link administrative state (IFF_UP flag). */
    ActivationPolicy?: 'up' | 'always-up' | 'manual' | 'always-down' | 'down' | 'bound';
  };
};

/**
 * [SR-IOV] section for .network files.
 * Configures SR-IOV virtual functions.
 */
export type NetworkSRIOV = {
  'SR-IOV': {
    /** Virtual Function number (0-2147483646). Compulsory. */
    VirtualFunction: number;
    /** VLAN ID of the virtual function (1-4095). */
    VLANId?: number;
    /** Quality of service of the virtual function (1-4294967294). */
    QualityOfService?: number;
    /** VLAN protocol of the virtual function. */
    VLANProtocol?: '802.1Q' | '802.1ad';
    /** Controls MAC spoof checking. */
    MACSpoofCheck?: 'on' | 'off';
    /** Toggle ability to query RSS configuration of the VF. */
    QueryReceiveSideScaling?: 'on' | 'off';
    /** Set trust mode of the VF. When set, VF users can set features impacting security/performance. */
    Trust?: 'on' | 'off';
    /** Link state of the VF. "auto" reflects PF state, "yes" allows VF communication even if PF is down, "no" drops VF packets. */
    LinkState?: 'on' | 'off' | 'auto';
    /** MAC address for the virtual function. */
    MACAddress?: string;
  };
};

/**
 * [Network] section for .network files.
 * Main network configuration section.
 */
export type NetworkNetwork = {
  Network: {
    /** Description of the device. Used for presentation purposes only. */
    Description?: string;
    /** Enable DHCPv4 and/or DHCPv6 client support. */
    DHCP?: 'yes' | 'no' | 'ipv4' | 'ipv6';
    /** Start DHCPv4 server on this interface. */
    DHCPServer?: 'on' | 'off';
    /** Enable link-local address autoconfiguration. */
    LinkLocalAddressing?: 'on' | 'off' | 'ipv4' | 'ipv6';
    /** Specifies how IPv6 link-local address is generated. */
    IPv6LinkLocalAddressGenerationMode?: 'eui64' | 'none' | 'stable-privacy' | 'random';
    /** IPv6 address used as stable secret for generating link-local address. */
    IPv6StableSecretAddress?: string;
    /** First IPv4 link-local address to try (from 169.254.0.0/16 excluding .0.0/24 and .255.0/24). */
    IPv4LLStartAddress?: string;
    /** Set up route for non-IPv4LL hosts to communicate with IPv4LL-only hosts. */
    IPv4LLRoute?: 'on' | 'off';
    /** Set up IPv4 default route bound to the interface. Useful for point-to-point interfaces. */
    DefaultRouteOnDevice?: 'on' | 'off';
    /** Enable Link-Local Multicast Name Resolution on the link. */
    LLMNR?: 'on' | 'off' | 'resolve';
    /** Enable Multicast DNS support on the link. */
    MulticastDNS?: 'on' | 'off' | 'resolve';
    /** Enable DNS-over-TLS support on the link. "opportunistic" tries TLS and falls back to UDP. */
    DNSOverTLS?: 'on' | 'off' | 'opportunistic';
    /** Enable DNSSEC validation on the link. "allow-downgrade" disables DNSSEC if server doesn't support it. */
    DNSSEC?: 'on' | 'off' | 'allow-downgrade';
    /** Space-separated list of DNSSEC negative trust anchor domains. */
    DNSSECNegativeTrustAnchors?: string;
    /** Control LLDP packet reception. "routers-only" collects only router LLDP data. */
    LLDP?: 'on' | 'off' | 'routers-only';
    /** Control LLDP packet emission. Special values control propagation level per IEEE 802.1AB-2016. */
    EmitLLDP?: 'on' | 'off' | 'nearest-bridge' | 'non-tpmr-bridge' | 'customer-bridge';
    /** Link names that control carrier state. When all are down, this link is brought down. Forces ActivationPolicy=bound. */
    BindCarrier?: string;
    /** Static IPv4 or IPv6 address with prefix length. Can be specified multiple times. */
    Address?: string | string[];
    /** Gateway address. Short-hand for a [Route] section with Gateway=. Can be specified multiple times. */
    Gateway?: string | string[];
    /** DNS server address. Can include port (:), interface (%), and SNI (#). Can be specified multiple times. */
    DNS?: string | string[];
    /** Default value for UseDomains= in [IPv6AcceptRA], [DHCPv4], and [DHCPv6] sections. */
    UseDomains?: 'on' | 'off' | 'route';
    /** Whitespace-separated list of DNS search/routing domains. Prefix with "~" for routing-only domains. */
    Domains?: string | string[];
    /** Use this link's DNS servers for domains not matching any configured Domains= setting. */
    DNSDefaultRoute?: 'on' | 'off';
    /** NTP server address (IP or hostname). Can be specified multiple times. */
    NTP?: string | string[];
    /** Configure IPv4 packet forwarding for the interface. Controls net.ipv4.conf.INTERFACE.forwarding. */
    IPv4Forwarding?: 'on' | 'off';
    /** Configure IPv6 forwarding for the interface. Controls net.ipv6.conf.INTERFACE.forwarding. */
    IPv6Forwarding?: 'on' | 'off';
    /** Configure IP masquerading. "ipv4"/"ipv6"/"both" implies corresponding Forwarding= settings. */
    IPMasquerade?: 'ipv4' | 'ipv6' | 'both' | 'no';
    /** Configure IPv6 privacy extensions (RFC 4941). "prefer-public" prefers public over temporary addresses. */
    IPv6PrivacyExtensions?: 'on' | 'off' | 'prefer-public' | 'kernel';
    /** Accept IPv6 Router Advertisements on the interface. */
    IPv6AcceptRA?: 'on' | 'off';
    /** Number of IPv6 Duplicate Address Detection probes to send. */
    IPv6DuplicateAddressDetection?: number;
    /** IPv6 Hop Limit (1-255). */
    IPv6HopLimit?: number;
    /** IPv6 Retransmission Time. Time between retransmitted Neighbor Solicitation messages. */
    IPv6RetransmissionTimeSec?: string;
    /** Maximum timeout for IPv4 Duplicate Address Detection (1ms-60s). Default 200ms. */
    IPv4DuplicateAddressDetectionTimeoutSec?: string;
    /** Configure IPv4 Reverse Path Filtering. "strict" tests against FIB, "loose" tests reachability. */
    IPv4ReversePathFilter?: 'no' | 'strict' | 'loose';
    /** Enforce IPv4 Multicast IGMP version. */
    MulticastIGMPVersion?: 'no' | 'v1' | 'v2' | 'v3';
    /** Accept packets with local source addresses. Useful for routing between local interfaces. */
    IPv4AcceptLocal?: 'on' | 'off';
    /** Allow use of 127.0.0.0/8 for local routing purposes. */
    IPv4RouteLocalnet?: 'on' | 'off';
    /** Enable proxy ARP for IPv4. */
    IPv4ProxyARP?: 'on' | 'off';
    /** Enable proxy ARP private VLAN (VLAN aggregation) for IPv4. */
    IPv4ProxyARPPrivateVLAN?: 'on' | 'off';
    /** Enable proxy NDP for IPv6. */
    IPv6ProxyNDP?: 'on' | 'off';
    /** IPv6 address for which Neighbour Advertisement messages will be proxied. Can be specified multiple times. */
    IPv6ProxyNDPAddress?: string | string[];
    /** Enable Router Advertisement sending on the link. */
    IPv6SendRA?: 'on' | 'off';
    /** Request subnet prefixes via DHCPv6 or DHCPv4 6RD option. */
    DHCPPrefixDelegation?: 'on' | 'off';
    /** IPv6 maximum transmission unit (>=1280 bytes). */
    IPv6MTUBytes?: number;
    /** Enable MPLS routing on this interface. Requires mpls_router kernel module. */
    MPLSRouting?: 'on' | 'off';
    /** Do not change the current master interface index. Ignores BatmanAdvanced=, Bond=, Bridge=, VRF=. */
    KeepMaster?: 'on' | 'off';
    /** Name of the B.A.T.M.A.N. Advanced interface to add the link to. */
    BatmanAdvanced?: string | string[];
    /** Name of the bond interface to add the link to. */
    Bond?: string | string[];
    /** Name of the bridge interface to add the link to. */
    Bridge?: string | string[];
    /** Name of the VRF interface to add the link to. */
    VRF?: string | string[];
    /** Name of the IPoIB interface to create on the link. */
    IPoIB?: string | string[];
    /** Name of the IPVLAN interface to create on the link. */
    IPVLAN?: string | string[];
    /** Name of the IPVTAP interface to create on the link. */
    IPVTAP?: string | string[];
    /** Name of the MACsec interface to create on the link. */
    MACsec?: string | string[];
    /** Name of the MACVLAN interface to create on the link. */
    MACVLAN?: string | string[];
    /** Name of the MACVTAP interface to create on the link. */
    MACVTAP?: string | string[];
    /** Name of the tunnel interface to create on the link. */
    Tunnel?: string | string[];
    /** Name of the VLAN interface to create on the link. */
    VLAN?: string | string[];
    /** Name of the VXLAN interface to create on the link. */
    VXLAN?: string | string[];
    /** Name of the Xfrm interface to create on the link. */
    Xfrm?: string | string[];
    /** Specifies the new active slave. Valid for active-backup, balance-alb, and balance-tlb modes. */
    ActiveSlave?: 'on' | 'off';
    /** Specifies which slave is the primary device. Valid for active-backup, balance-alb, and balance-tlb modes. */
    PrimarySlave?: 'on' | 'off';
    /** Allow configuration even if the link has no carrier. */
    ConfigureWithoutCarrier?: 'on' | 'off';
    /** Retain configuration when carrier is lost. Takes 'on' | 'off' or timespan. */
    IgnoreCarrierLoss?: string;
    /** Whether to drop static/dynamic configuration on restart. "dynamic" never drops dynamic addresses. */
    KeepConfiguration?: 'on' | 'off' | 'static' | 'dynamic-on-stop' | 'dynamic';
  };
};

/**
 * [Address] section for .network files.
 * Configures static IP addresses.
 */
export type NetworkAddress = {
  Address: {
    /** Static IP address with prefix length. Mandatory. */
    Address: string;
    /** Peer address for point-to-point connections. */
    Peer?: string;
    /** IPv4 broadcast address, or true to derive from Address=, or false to not set. */
    Broadcast?: string;
    /** Label for the IPv4 address (1-15 ASCII characters). */
    Label?: string;
    /** Override the preferred lifetime of the address. "forever"/"infinity" means never expires, "0" means expired. */
    PreferredLifetime?: 'forever' | 'infinity' | '0';
    /** Scope of the address. IPv4 only - IPv6 scope is auto-assigned by kernel. */
    Scope?: 'global' | 'link' | 'host' | number;
    /** Metric of the prefix route (0-4294967295). */
    RouteMetric?: number;
    /** Designate this address as "home address" per RFC 6275 (Mobile IPv6). IPv6 only. */
    HomeAddress?: 'on' | 'off';
    /** Perform Duplicate Address Detection. "ipv4" for RFC 5227, "ipv6" for RFC 4862. */
    DuplicateAddressDetection?: 'ipv4' | 'ipv6' | 'both' | 'none';
    /** Let kernel manage temporary addresses for Privacy Extensions (RFC 3041). Requires prefix length 64. */
    ManageTemporaryAddress?: 'on' | 'off';
    /** Automatically add prefix route for the address. */
    AddPrefixRoute?: 'on' | 'off';
    /** Join multicast group on ethernet level. Useful for OVS VXLAN and similar tunneling. */
    AutoJoin?: 'on' | 'off';
    /** NetLabel label for LSM network access control (SELinux). */
    NetLabel?: string;
    /** NFT set definitions for firewall integration. Format: "source:family:table:set". */
    NFTSet?: string | string[];
  };
};

/**
 * [Neighbor] section for .network files.
 * Configures static ARP/NDP entries.
 */
export type NetworkNeighbor = {
  Neighbor: {
    /** IP address of the neighbor. */
    Address: string;
    /** Link layer address (MAC address or IP address) of the neighbor. */
    LinkLayerAddress: string;
  };
};

/**
 * [IPv6AddressLabel] section for .network files.
 * Configures IPv6 address labels for address selection (RFC 3484).
 */
export type NetworkIPv6AddressLabel = {
  IPv6AddressLabel: {
    /** Label for the prefix (0-4294967294). Mandatory. */
    Label: number;
    /** IPv6 address with prefix length. Mandatory. */
    Prefix: string;
  };
};

/**
 * [RoutingPolicyRule] section for .network files.
 * Configures policy-based routing rules.
 */
export type NetworkRoutingPolicyRule = {
  RoutingPolicyRule: {
    /** Type of Service field to match (0-255). Can specify DSCP/ECN. */
    TypeOfService?: number;
    /** Source address prefix to match. */
    From?: string;
    /** Destination address prefix to match. */
    To?: string;
    /** iptables firewall mark to match (0-4294967295). Optional mask with "/". */
    FirewallMark?: string;
    /** Routing table identifier to look up. Takes predefined names or number (1-4294967295). */
    Table?: string | number;
    /** Priority of this rule (0-4294967295). Higher number = lower priority. */
    Priority?: number;
    /** Target priority for "goto" type rules. Must be larger than the rule's Priority=. */
    GoTo?: number;
    /** Incoming device to match. Loopback matches packets from this host. */
    IncomingInterface?: string;
    /** Outgoing device to match. Only available for packets from local sockets bound to a device. */
    OutgoingInterface?: string;
    /** Direct lookups to tables associated with L3 master devices (VRF). */
    L3MasterDevice?: 'on' | 'off';
    /** Source IP port or port range to match. Range specified as "lower-upper". */
    SourcePort?: string;
    /** Destination IP port or port range to match. Range specified as "lower-upper". */
    IPProtocol?: string;
    /** IP protocol to match (name like "tcp"/"udp" or number like "6"/"17"). */
    InvertRule?: 'on' | 'off';
    /** Address family. By default determined by To= or From=. */
    Family?: 'ipv4' | 'ipv6' | 'both';
    /** Username, user ID, or range of user IDs to match. */
    User?: string;
    /** Reject routing decisions with prefix length N or less (0-128). */
    SuppressPrefixLength?: number;
    /** Reject routing decisions for interfaces with the same group ID (0-2147483647). */
    SuppressInterfaceGroup?: number;
    /** RPDB rule type. "goto" requires GoTo= to be set. */
    Type?: 'table' | 'goto' | 'nop' | 'blackhole' | 'unreachable' | 'prohibit';
  };
};

/**
 * [NextHop] section for .network files.
 * Configures kernel nexthop objects.
 */
export type NetworkNextHop = {
  NextHop: {
    /** Nexthop ID (1-4294967295). Mandatory when ManageForeignNextHops=no. */
    Id?: number;
    /** Gateway address. */
    Gateway?: string;
    /** Address family. By default determined by Gateway=. */
    Family?: 'ipv4' | 'ipv6';
    /** Skip gateway reachability check when inserting the nexthop. */
    OnLink?: 'on' | 'off';
    /** Silently discard packets to corresponding routes. Gateway= cannot be specified. */
    Blackhole?: 'on' | 'off';
    /** Whitespace-separated list of nexthop IDs with optional weights ("id[:weight]"). */
    Group?: string | string[];
  };
};

/**
 * [Route] section for .network files.
 * Configures static routes.
 */
export type NetworkRoute = {
  Route: {
    /** Gateway address, or "_dhcp4"/"_ipv6ra" to use gateway from DHCPv4 or IPv6 RA. */
    Gateway?: string;
    /** Skip gateway reachability check when inserting the route. */
    GatewayOnLink?: 'on' | 'off';
    /** Destination prefix of the route. Full-length host route assumed if omitted. */
    Destination?: string;
    /** Source prefix of the route. Full-length host route assumed if omitted. */
    Source?: string;
    /** Metric of the route (0-4294967295). */
    Metric?: number;
    /** Route preference per RFC 4191 for Router Discovery messages. */
    IPv6Preference?: 'low' | 'medium' | 'high';
    /** Scope of the IPv4 route. Not used for IPv6. */
    Scope?: 'global' | 'site' | 'link' | 'host' | 'nowhere';
    /** Preferred source address for the route. "no" prevents setting preferred source with Gateway=_dhcp4. */
    PreferredSource?: string;
    /** Routing table identifier. Takes predefined names or number (1-4294967295). */
    Table?: string | number;
    /** Per-route hop limit (1-255). */
    HopLimit?: number;
    /** Protocol identifier for the route. */
    Protocol?: number | 'kernel' | 'boot' | 'static' | 'ra' | 'dhcp';
    /** Type of route. "unicast" is regular, "blackhole" silently discards, "unreachable" sends ICMP host unreachable. */
    Type?:
      | 'unicast'
      | 'local'
      | 'broadcast'
      | 'anycast'
      | 'multicast'
      | 'blackhole'
      | 'unreachable'
      | 'prohibit'
      | 'throw'
      | 'nat'
      | 'xresolve';
    /** TCP initial congestion window (1-1023). */
    InitialCongestionWindow?: number;
    /** TCP initial advertised receive window in bytes (1-1023). */
    InitialAdvertisedReceiveWindow?: number;
    /** Enable TCP quick ACK mode for the route. */
    QuickAck?: 'on' | 'off';
    /** Enable TCP fastopen without cookie on a per-route basis. */
    FastOpenNoCookie?: 'on' | 'off';
    /** Maximum transmission unit for the route. Suffixes K, M, G supported. */
    MTUBytes?: string;
    /** Path MSS hints for TCP layer (1-4294967294). Suffixes K, M, G supported. */
    TCPAdvertisedMaximumSegmentSize?: number;
    /** TCP congestion control algorithm for the route (e.g. "bbr", "dctcp", "vegas"). */
    TCPCongestionControlAlgorithm?: string;
    /** TCP Retransmission Timeout for the route. */
    TCPRetransmissionTimeoutSec?: string;
    /** Multipath route configuration. Format: "gateway@ifname weight". Can be specified multiple times. */
    MultiPathRoute?: string | string[];
    /** Nexthop ID. Requires corresponding [NextHop] section. */
    NextHop?: number;
  };
};

/**
 * [DHCPv4] section for .network files.
 * Configures the DHCPv4 client.
 */
export type NetworkDHCPv4 = {
  DHCPv4: {
    /** Requested IP address added to initial DHCPDISCOVER (option 50). */
    RequestAddress?: string;
    /** Send hostname to DHCP server. Single-label sent as option 12, FQDN as option 81. */
    SendHostname?: 'on' | 'off';
    /** Hostname to send instead of machine hostname. Must be valid DNS domain name. */
    Hostname?: string;
    /** Manufacturer Usage Description URL (RFC 8520). Up to 255 characters. */
    MUDURL?: string;
    /** Client identifier type. "mac" uses MAC address, "duid" uses RFC4361-compliant IAID+DUID. */
    ClientIdentifier?: 'mac' | 'duid';
    /** Vendor class identifier to identify vendor type and configuration. */
    VendorClassIdentifier?: string;
    /** Whitespace-separated list of user class strings to identify user/application type. */
    UserClass?: string | string[];
    /** Override global DUIDType= setting for this network. */
    DUIDType?: string;
    /** Override global DUIDRawData= setting for this network. */
    DUIDRawData?: string;
    /** DHCP Identity Association Identifier (32-bit unsigned integer). */
    IAID?: number;
    /** Enable rapid two-message exchange (RFC 4039). Requires server support. */
    RapidCommit?: 'on' | 'off';
    /** Minimize identifying information per RFC 7844. Implies several other settings. */
    Anonymize?: 'on' | 'off';
    /** DHCP options to request from server (1-254). */
    RequestOptions?: number | number[];
    /** Send arbitrary raw DHCP option. Format: "option:type:value". */
    SendOption?: string | string[];
    /** Send arbitrary vendor DHCP option. Format: "option:type:value". */
    SendVendorOption?: string | string[];
    /** IP service type for DHCP packets. "CS6" for network control, "CS4" for realtime. */
    IPServiceType?: 'none' | 'CS6' | 'CS4';
    /** SO_PRIORITY applied to raw IP socket for initial DHCPv4 messages. */
    SocketPriority?: number;
    /** Communicate with BOOTP servers instead of DHCP servers. */
    BOOTP?: 'on' | 'off';
    /** Label for the IPv4 address received from DHCP server (1-15 ASCII characters). */
    Label?: string;
    /** Use DNS servers received from DHCP server. */
    UseDNS?: 'on' | 'off';
    /** Configure routes to DNS servers received from DHCP server. */
    RoutesToDNS?: 'on' | 'off';
    /** Use NTP servers received from DHCP server. */
    UseNTP?: 'on' | 'off';
    /** Configure routes to NTP servers received from DHCP server. */
    RoutesToNTP?: 'on' | 'off';
    /** Use SIP servers received from DHCP server. */
    UseSIP?: 'on' | 'off';
    /** Record captive portal from DHCP server. */
    UseCaptivePortal?: 'on' | 'off';
    /** Use designated resolvers (RFC 9463) from DHCP server as encrypted DNS. */
    UseDNR?: 'on' | 'off';
    /** Use MTU from DHCP server on current link. */
    UseMTU?: 'on' | 'off';
    /** Set hostname received from DHCP server as transient hostname. */
    UseHostname?: 'on' | 'off';
    /** Use domain name from DHCP server as DNS search domain. "route" for routing-only. */
    UseDomains?: 'on' | 'off' | 'route';
    /** Request and add static routes from DHCP server (metric 1024). */
    UseRoutes?: 'on' | 'off';
    /** Routing metric for DHCP routes (0-4294967295). Default 1024. */
    RouteMetric?: number;
    /** Routing table for DHCP routes. */
    RouteTable?: string | number;
    /** MTU for DHCP routes. */
    RouteMTUBytes?: string;
    /** Enable TCP quick ACK mode for routes from DHCPv4 lease. */
    QuickAck?: 'on' | 'off';
    /** TCP initial congestion window for DHCP routes. */
    InitialCongestionWindow?: number;
    /** TCP initial advertised receive window for DHCP routes. */
    InitialAdvertisedReceiveWindow?: number;
    /** Configure default gateway from DHCP Router option. */
    UseGateway?: 'on' | 'off';
    /** Set timezone received from DHCP server as system timezone. */
    UseTimezone?: 'on' | 'off';
    /** Enable IPv6-over-DHCPv4 (6RD) for prefix delegation (RFC 5969). */
    Use6RD?: 'on' | 'off';
    /** Reject route type for unassigned 6RD subnets. */
    UnassignedSubnetPolicy?: 'none' | 'unreachable' | 'prohibit' | 'blackhole' | 'throw';
    /** Delay IPv4 configuration if IPv6 connectivity is provided (RFC 8925). */
    IPv6OnlyMode?: 'on' | 'off';
    /** Lease lifetime when server doesn't send one. "forever"/"infinity" means never expires. */
    FallbackLeaseLifetimeSec?: 'forever' | 'infinity';
    /** Request broadcast messages before IP address is configured. */
    RequestBroadcast?: 'on' | 'off';
    /** Number of DHCPv4 configuration attempts. "infinity" for unlimited. */
    MaxAttempts?: number | 'infinity';
    /** Source port for DHCP client packets. */
    ListenPort?: number;
    /** Port on which the DHCP server is listening. */
    ServerPort?: number;
    /** Reject DHCP offers from servers in this list. Ignored if AllowList= is set. */
    DenyList?: string | string[];
    /** Accept only DHCP offers from servers in this list. */
    AllowList?: string | string[];
    /** Send DHCP release packet when client stops. */
    SendRelease?: 'on' | 'off';
    /** Perform IPv4 DAD and send DHCPDECLINE if duplicate detected (RFC 5227). */
    SendDecline?: 'on' | 'off';
    /** Apply NetLabel for addresses received via DHCP. */
    NetLabel?: string;
    /** Apply NFT set for network configuration received via DHCP. */
    NFTSet?: string | string[];
  };
};

/**
 * [DHCPv6] section for .network files.
 * Configures the DHCPv6 client.
 */
export type NetworkDHCPv6 = {
  DHCPv6: {
    /** Manufacturer Usage Description URL (RFC 8520). */
    MUDURL?: string;
    /** DHCP Identity Association Identifier (32-bit unsigned integer). */
    IAID?: number;
    /** Override global DUIDType= setting for this network. */
    DUIDType?: string;
    /** Override global DUIDRawData= setting for this network. */
    DUIDRawData?: string;
    /** DHCP options to request from server (1-65536 for DHCPv6). */
    RequestOptions?: number | number[];
    /** Send arbitrary raw DHCP option. Format: "option:type:value". */
    SendOption?: string | string[];
    /** Send arbitrary vendor DHCP option. Format: "enterprise:option:type:value". */
    SendVendorOption?: string | string[];
    /** Whitespace-separated list of user class strings. NUL bytes not allowed. */
    UserClass?: string | string[];
    /** Whitespace-separated list of vendor class strings identifying hardware manufacturer. */
    VendorClass?: string | string[];
    /** IPv6 prefix hint included in DHCPv6 solicitation. */
    PrefixDelegationHint?: string;
    /** Reject route type for unassigned delegated prefixes. */
    UnassignedSubnetPolicy?: 'none' | 'unreachable' | 'prohibit' | 'blackhole' | 'throw';
    /** Enable rapid two-message exchange (RFC 3315). */
    RapidCommit?: 'on' | 'off';
    /** Send hostname to DHCPv6 server. Must be valid DNS domain name without spaces or dots. */
    SendHostname?: 'on' | 'off';
    /** Hostname to send instead of machine hostname. */
    Hostname?: string;
    /** Assign IP addresses provided by DHCPv6 server. */
    UseAddress?: 'on' | 'off';
    /** Record captive portal from DHCPv6 server. */
    UseCaptivePortal?: 'on' | 'off';
    /** Request DHCPv6 server to delegate prefixes. */
    UseDelegatedPrefix?: 'on' | 'off';
    /** Use DNS servers received in Router Advertisement. */
    UseDNS?: 'on' | 'off';
    /** Use DNR servers received in Router Advertisement. */
    UseDNR?: 'on' | 'off';
    /** Use NTP servers received from DHCPv6 server. */
    UseNTP?: 'on' | 'off';
    /** Use SIP servers received from DHCPv6 server. */
    UseSIP?: 'on' | 'off';
    /** Set hostname received from DHCPv6 server as transient hostname. */
    UseHostname?: 'on' | 'off';
    /** Use domain name from DHCPv6 server as DNS search domain. "route" for routing-only. */
    UseDomains?: 'on' | 'off' | 'route';
    /** Apply NetLabel for addresses received via DHCPv6. */
    NetLabel?: string;
    /** Send DHCPv6 release packet when client stops. */
    SendRelease?: 'on' | 'off';
    /** Apply NFT set for network configuration received via DHCPv6. */
    NFTSet?: string | string[];
    /** Start DHCPv6 client without RA flags. "solicit" for address, "information-request" for other config. */
    WithoutRA?: 'no' | 'solicit' | 'information-request';
  };
};

/**
 * [DHCPPrefixDelegation] section for .network files.
 * Configures subnet prefixes from delegated prefixes.
 */
export type NetworkDHCPPrefixDelegation = {
  DHCPPrefixDelegation: {
    /** Uplink interface name/index, or ":self" for the interface itself, or ":auto" for first link with prefixes. */
    UplinkInterface?: string;
    /** Subnet ID. "auto" for automatic, or hexadecimal value (0-0x7fffffffffffffff). */
    SubnetId?: string;
    /** Distribute delegated prefixes via IPv6 Router Advertisement when IPv6SendRA= is enabled. */
    Announce?: 'on' | 'off';
    /** Add an address from delegated prefixes. Uses EUI-64 by default. */
    Assign?: 'on' | 'off';
    /** Address generation mode for delegated prefixes. Same syntax as Token= in [IPv6AcceptRA]. */
    Token?: string | string[];
    /** Let kernel manage temporary addresses for Privacy Extensions. Defaults to true. */
    ManageTemporaryAddress?: 'on' | 'off';
    /** Metric of the route to delegated prefix subnet (0-4294967295). Default 256. */
    RouteMetric?: number;
    /** Apply NetLabel for addresses received via DHCP prefix delegation. */
    NetLabel?: string;
    /** Apply NFT set for network configuration received via DHCP prefix delegation. */
    NFTSet?: string | string[];
  };
};

/**
 * [IPv6AcceptRA] section for .network files.
 * Configures the IPv6 Router Advertisement client.
 */
export type NetworkIPv6AcceptRA = {
  IPv6AcceptRA: {
    /** Accept Redirect messages and configure routes to redirected nodes. */
    UseRedirect?: 'on' | 'off';
    /** Address generation mode for SLAAC. "eui64", "static:ADDRESS", or "prefixstable[:ADDRESS][,UUID]". */
    Token?: string | string[];
    /** Use DNS servers received in Router Advertisement. */
    UseDNS?: 'on' | 'off';
    /** Use DNR servers received in Router Advertisement. */
    UseDNR?: 'on' | 'off';
    /** Use domain name from RA as DNS search domain. "route" for routing-only. */
    UseDomains?: 'on' | 'off' | 'route';
    /** Routing table for routes received in Router Advertisement. */
    RouteTable?: string | number;
    /** Routing metric for RA routes. Can be single value or "high:medium:low" for per-preference metrics. */
    RouteMetric?: string | number;
    /** Enable TCP quick ACK mode for routes from RAs. */
    QuickAck?: 'on' | 'off';
    /** Use MTU received in Router Advertisement. */
    UseMTU?: 'on' | 'off';
    /** Use hop limit received in Router Advertisement for routes. */
    UseHopLimit?: 'on' | 'off';
    /** Use reachable time received in Router Advertisement on the interface. */
    UseReachableTime?: 'on' | 'off';
    /** Use retransmission time received in Router Advertisement on the interface. */
    UseRetransmissionTime?: 'on' | 'off';
    /** Configure router address as default gateway. */
    UseGateway?: 'on' | 'off';
    /** Configure routes corresponding to route prefixes received in RA. */
    UseRoutePrefix?: 'on' | 'off';
    /** Record captive portal received in Router Advertisement. */
    UseCaptivePortal?: 'on' | 'off';
    /** Record IPv6 PREF64/NAT64 prefixes received in RA (RFC 8781). */
    UsePREF64?: 'on' | 'off';
    /** Use autonomous prefix received in RA for SLAAC. */
    UseAutonomousPrefix?: 'on' | 'off';
    /** Use onlink prefix received in RA. */
    UseOnLinkPrefix?: 'on' | 'off';
    /** Ignore information from listed IPv6 router addresses. */
    RouterDenyList?: string | string[];
    /** Accept information only from listed IPv6 router addresses. Overrides RouterDenyList=. */
    RouterAllowList?: string | string[];
    /** Ignore IPv6 prefixes in this list from RAs. */
    PrefixDenyList?: string | string[];
    /** Allow only IPv6 prefixes in this list from RAs. Overrides PrefixDenyList=. */
    PrefixAllowList?: string | string[];
    /** Ignore IPv6 route prefixes in this list from RAs. */
    RouteDenyList?: string | string[];
    /** Allow only IPv6 route prefixes in this list from RAs. Overrides RouteDenyList=. */
    RouteAllowList?: string | string[];
    /** Start DHCPv6 client when RA is received. "always" starts even without managed/other-config flags. */
    DHCPv6Client?: 'on' | 'off' | 'always';
    /** Apply NetLabel for addresses received via RA. */
    NetLabel?: string;
    /** Apply NFT set for network configuration received via RA. */
    NFTSet?: string | string[];
  };
};

/**
 * [DHCPServer] section for .network files.
 * Configures the DHCPv4 server.
 */
export type NetworkDHCPServer = {
  DHCPServer: {
    /** Server address with prefix length. Implies Address= in [Network] or [Address]. */
    ServerAddress?: string;
    /** Offset of the address pool from the start of subnet. */
    PoolOffset?: number;
    /** Number of IP addresses in the pool. */
    PoolSize?: number;
    /** Default DHCP lease time for clients that don't request specific time. */
    DefaultLeaseTimeSec?: string;
    /** Maximum DHCP lease time. Client requests longer than this are shortened. */
    MaxLeaseTimeSec?: string;
    /** Uplink interface for propagating DNS/NTP/SIP servers. ":auto" selects link with highest-priority default gateway. */
    UplinkInterface?: string;
    /** Emit DNS server information in DHCP leases. */
    EmitDNS?: 'on' | 'off';
    /** DNS servers to pass to clients. "_server_address" uses the DHCP server address. */
    DNS?: string | string[];
    /** Emit NTP server information in DHCP leases. */
    EmitNTP?: 'on' | 'off';
    /** NTP servers to pass to clients. */
    NTP?: string | string[];
    /** Emit SIP server information in DHCP leases. */
    EmitSIP?: 'on' | 'off';
    /** SIP servers to pass to clients. */
    SIP?: string | string[];
    /** Emit POP3 server information in DHCP leases. */
    EmitPOP3?: 'on' | 'off';
    /** POP3 servers to pass to clients. */
    POP3?: string | string[];
    /** Emit SMTP server information in DHCP leases. */
    EmitSMTP?: 'on' | 'off';
    /** SMTP servers to pass to clients. */
    SMTP?: string | string[];
    /** Emit LPR server information in DHCP leases. */
    EmitLPR?: 'on' | 'off';
    /** LPR servers to pass to clients. */
    LPR?: string | string[];
    /** Emit router option in DHCP leases. */
    EmitRouter?: 'on' | 'off';
    /** Router address to emit. Defaults to server address. */
    Router?: string;
    /** Emit timezone information in DHCP leases. */
    EmitTimezone?: 'on' | 'off';
    /** Timezone to pass to clients (e.g. "Europe/Berlin" or "UTC"). */
    Timezone?: string;
    /** Emit domain name information (DHCP option 15) in DHCP leases. */
    EmitDomain?: 'on' | 'off';
    /** DNS default domain for DHCP clients. Derived from system FQDN if not set. */
    Domain?: string;
    /** Boot server address for PXE boot systems (siaddr field). */
    BootServerAddress?: string;
    /** Boot server name for PXE boot systems (DHCP option 66). */
    BootServerName?: string;
    /** Bootfile path/URL for PXE boot loaders (DHCP option 67). */
    BootFilename?: string;
    /** RFC 8925 IPv6-Only Preferred option timespan. Minimum 300 seconds. */
    IPv6OnlyPreferredSec?: string;
    /** Send raw option via DHCPv4 server. Format: "option:type:value". */
    SendOption?: string | string[];
    /** Send vendor option via DHCPv4 server. Format: "option:type:value". */
    SendVendorOption?: string | string[];
    /** Bind DHCP server socket to network interface. */
    BindToInterface?: 'on' | 'off';
    /** Turn DHCP server into a DHCP relay agent. Address of DHCP server or another relay. */
    RelayTarget?: string;
    /** Agent Circuit ID suboption value for Relay Agent Information. Format: "string:value". */
    RelayAgentCircuitId?: string;
    /** Agent Remote ID suboption value for Relay Agent Information. Format: "string:value". */
    RelayAgentRemoteId?: string;
    /** Support RFC 4039 rapid commit (DHCPDISCOVER -> DHCPACK). */
    RapidCommit?: 'on' | 'off';
    /** Lease persistence mode. "runtime" saves to runtime storage only. */
    PersistLeases?: 'on' | 'off' | 'runtime';
    /** DNS domain for integrating DHCP leases with systemd-resolved for local hostname resolution. */
    LocalLeaseDomain?: string;
  };
};

/**
 * [DHCPServerStaticLease] section for .network files.
 * Configures static DHCP leases.
 */
export type NetworkDHCPServerStaticLease = {
  DHCPServerStaticLease: {
    /** Hardware address of the device to match. Mandatory. */
    MACAddress: string;
    /** IPv4 address to assign to the matched device. Mandatory. */
    Address: string;
    /** Hostname to send to the client in DHCP replies. Simple or FQDN. */
    Hostname?: string;
  };
};

/**
 * [IPv6SendRA] section for .network files.
 * Configures IPv6 Router Advertisement sending.
 */
export type NetworkIPv6SendRA = {
  IPv6SendRA: {
    /** Indicate DHCPv6 server is used to acquire IPv6 addresses. */
    Managed?: 'on' | 'off';
    /** Indicate only additional network info can be obtained via DHCPv6. */
    OtherInformation?: 'on' | 'off';
    /** IPv6 router lifetime (0 or 4-9000 seconds). 0 means not acting as router. Default 1800s. */
    RouterLifetimeSec?: string;
    /** Time clients can assume a neighbor is reachable (0-4294967295 ms). 0 means unspecified. */
    ReachableTimeSec?: string;
    /** Retransmit time for address resolution and NUD (0-4294967295 ms). 0 means unspecified. */
    RetransmitSec?: string;
    /** Router preference per RFC 4191. "normal"/"default" are synonyms for "medium". */
    RouterPreference?: 'high' | 'medium' | 'low' | 'normal' | 'default';
    /** Hop limit (0-255). */
    HopLimit?: number;
    /** Uplink interface for propagating DNS servers/domains. ":auto" uses DHCPPrefixDelegation or highest-priority gateway. */
    UplinkInterface?: string;
    /** Emit DNS server addresses in Router Advertisement messages. */
    EmitDNS?: 'on' | 'off';
    /** Recursive DNS server IPv6 addresses distributed via RA. "_link_local" uses the link-local address. */
    DNS?: string | string[];
    /** Emit DNS search domains in Router Advertisement messages. */
    EmitDomains?: 'on' | 'off';
    /** DNS search domains distributed via RA. */
    Domains?: string | string[];
    /** Lifetime in seconds for DNS servers and search domains. Default 3600s. */
    DNSLifetimeSec?: string;
    /** Indicate router acts as a Home Agent per RFC 6275. */
    HomeAgent?: 'on' | 'off';
    /** Lifetime of the Home Agent (1-65535 seconds). Defaults to RouterLifetimeSec=. */
    HomeAgentLifetimeSec?: string;
    /** Home Agent preference (0-65535). Default 0. */
    HomeAgentPreference?: number;
  };
};

/**
 * [IPv6Prefix] section for .network files.
 * Configures IPv6 prefixes announced via Router Advertisements.
 */
export type NetworkIPv6Prefix = {
  IPv6Prefix: {
    /** Allow IPv6 address autoconfiguration with this prefix. */
    AddressAutoconfiguration?: 'on' | 'off';
    /** Allow prefix to be used for onlink determination. */
    OnLink?: 'on' | 'off';
    /** IPv6 prefix to distribute to hosts. Mandatory. */
    Prefix: string;
    /** Preferred lifetime for the prefix in seconds. Default 1800s. */
    PreferredLifetimeSec?: string;
    /** Valid lifetime for the prefix in seconds. Default 3600s. */
    ValidLifetimeSec?: string;
    /** Add an address from the prefix. */
    Assign?: 'on' | 'off';
    /** Address generation mode for the prefix. Same syntax as Token= in [IPv6AcceptRA]. */
    Token?: string | string[];
    /** Metric of the prefix route (0-4294967295). Ignored when Assign=false. */
    RouteMetric?: number;
  };
};

/**
 * [IPv6RoutePrefix] section for .network files.
 * Configures IPv6 route prefixes announced via Router Advertisements.
 */
export type NetworkIPv6RoutePrefix = {
  IPv6RoutePrefix: {
    /** IPv6 route to distribute to hosts. Mandatory. */
    Route: string;
    /** Lifetime for the route prefix in seconds. Default 3600s. */
    LifetimeSec?: string;
    /** Preference of the route option. */
    Preference?: 'high' | 'medium' | 'low';
  };
};

/**
 * [IPv6PREF64Prefix] section for .network files.
 * Configures IPv6 PREF64/NAT64 prefixes announced via Router Advertisements.
 */
export type NetworkIPv6PREF64Prefix = {
  IPv6PREF64Prefix: {
    /** NAT64 prefix for 464XLAT. Valid lengths: 96, 64, 56, 48, 40, 32 bits. */
    Prefix: string;
    /** Lifetime for the prefix in seconds. Should be >= RouterLifetimeSec=. Default 1800s. */
    LifetimeSec?: string;
  };
};

/**
 * [Bridge] section for .network files (port settings).
 * Configures bridge port settings.
 */
export type NetworkBridgePort = {
  Bridge: {
    /** Flood traffic for which an FDB entry is missing through this port. */
    UnicastFlood?: 'on' | 'off';
    /** Flood traffic for which an MDB entry is missing through this port. */
    MulticastFlood?: 'on' | 'off';
    /** Convert multicast to unicast for hosts interested in it (requires multicast snooping). */
    MulticastToUnicast?: 'on' | 'off';
    /** Enable ARP and ND neighbor suppression for this port. */
    NeighborSuppression?: 'on' | 'off';
    /** Enable MAC address learning for this port. */
    Learning?: 'on' | 'off';
    /** Isolate this port from other isolated ports. */
    Isolated?: 'on' | 'off';
    /** Protect this port from receiving traffic from other protected ports. */
    Protected?: 'on' | 'off';
    /** Trust this port for ingress policy enforcement. */
    Trusted?: 'on' | 'off';
    /** Enable fast leave for multicast groups on this port. */
    FastLeave?: 'on' | 'off';
    /** Allow this port to become root port. */
    AllowPortToBeRoot?: 'on' | 'off';
    /** Port cost for STP. */
    Cost?: number;
    /** Port priority for STP. */
    Priority?: number;
    /** Enable hairpin mode (allow traffic to be reflected back). */
    Hairpin?: 'on' | 'off';
    /** Control multicast router port state. "auto" for automatic detection. */
    MulticastRouter?: 'on' | 'off' | 'auto';
    /** Multicast EHT hosts to allow. */
    MulticastEHTHostsAllow?: string | string[];
    /** Multicast EHT hosts to deny. */
    MulticastEHTHostsDeny?: string | string[];
    /** Maximum number of multicast subscriptions on this port. */
    MulticastMaxSubscriptions?: number;
    /** Send multicast querier to this port. */
    MulticastQuerierToPort?: 'on' | 'off';
    /** Flood broadcast traffic on this port. */
    MulticastBroadcastFlood?: 'on' | 'off';
    /** Multicast group for this port. */
    MulticastGroup?: string;
    /** Multicast group address for this port. */
    MulticastGroupAddress?: string;
    /** Process BPDUs on this port. */
    UseBPDU?: 'on' | 'off';
    /** Allow topology change notifications on this port. */
    TopologyChange?: 'on' | 'off';
    /** Enable BPDU guard on this port. */
    Guard?: 'on' | 'off';
    /** Mark this port as a backup port. */
    BackupPort?: 'on' | 'off';
    /** Hide this port from bridge topology. */
    Hidden?: 'on' | 'off';
    /** Lock this port to learned MAC addresses only. */
    Locked?: 'on' | 'off';
    /** Mark this port as a multicast router. */
    MRouter?: 'on' | 'off';
  };
};
