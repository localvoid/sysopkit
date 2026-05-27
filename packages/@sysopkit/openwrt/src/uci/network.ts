export type UciNetwork = UciNetworkSection[];

export type UciNetworkSection =
  | UciNetworkInterface
  | UciNetworkDevice
  | UciNetworkGlobals
  | UciNetworkRoute
  | UciNetworkRule
  | UciNetworkBridgeVlan;

export type UciNetworkInterface = {
  type: 'interface';
  name?: string;

  options: {
    /** Logical device name (e.g. br-lan). */
    device: string;
    /** Protocol: static, dhcp, dhcpv6, pppoe, wireguard, none. */
    proto: string;
    /** IPv4 address. */
    ipaddr?: string;
    /** IPv4 netmask. */
    netmask?: string;
    /** IPv4 gateway. */
    gateway?: string;
    /** Broadcast address. */
    broadcast?: string;
    /** IPv6 address. */
    ip6addr?: string;
    /** IPv6 gateway. */
    ip6gw?: string;
    /** IPv6 prefix assignment (e.g. 60). */
    ip6assign?: string | number;
    /** DNS servers (comma-separated or use dns list). */
    dns?: string;
    /** Layer */
    layer?: string | number;

    /** Bring interface up on boot. */
    auto?: '0' | '1';
    /** Enable Spanning Tree Protocol. */
    stp?: '0' | '1';
    /** Force link detection. */
    force_link?: '0' | '1';
    /** Interface metric. */
    metric?: string | number;
    /** MTU size. */
    mtu?: string | number;
    /** MAC address. */
    macaddr?: string;
    /** PPPoE username. */
    username?: string;
    /** PPPoE password. */
    password?: string;
    /** WireGuard private key. */
    private_key?: string;
    /** WireGuard public key (peer). */
    public_key?: string;
    /** WireGuard endpoint. */
    endpoint_host?: string;
    /** WireGuard endpoint port. */
    endpoint_port?: string | number;
    /** WireGuard allowed IPs. */
    allowed_ips?: string;
    /** WireGuard persistent keepalive. */
    persistent_keepalive?: string | number;
    /** WireGuard listen port. */
    listen_port?: string | number;
  };
  lists?: {
    /** DNS servers. */
    dns?: string[];
    /** DNS search domains. */
    dns_search?: string[];
    /** IP addresses (for multi-IP). */
    ipaddr?: string[];
    /** WireGuard allowed IPs (list form). */
    allowed_ips?: string[];
  };
};

export type UciNetworkDevice = {
  type: 'device';
  name?: string;

  options: {
    /** Device name. */
    name?: string;
    /** Device type: bridge, tunnel, etc. */
    type?: string;
    /** Enable Spanning Tree Protocol. */
    stp?: '0' | '1';
    /** STP hello interval. */
    hello_interval?: string | number;
    /** STP max age. */
    max_age?: string | number;
    /** STP priority. */
    priority?: string | number;
    /** STP forward delay. */
    forward_delay?: string | number;
    /** Bridge VLAN filtering. */
    vlan_filtering?: '0' | '1';
    /** MTU size. */
    mtu?: string | number;
    /** MAC address. */
    macaddr?: string;
    /** Enable promiscuous mode. */
    promisc?: '0' | '1';
    /** Enable IGMP snooping. */
    igmp_snooping?: '0' | '1';
    /** Multicast querier. */
    multicast_querier?: '0' | '1';
  };
  lists?: {
    /** Member ports. */
    ports?: string[];
  };
};

export type UciNetworkGlobals = {
  type: 'globals';
  name?: string;

  options: {
    /** ULA prefix (e.g. fdxx:xxxx:xxxx::/48). */
    ula_prefix?: string;
    /**
     * Use every CPU to handle packet traffic:
     * - 0 - disabled
     * - 1 - enabled
     * - 2 - enabled for all CPUs
     */
    packet_steering?: '0' | '1' | '2';
  };
};

export type UciNetworkRoute = {
  type: 'route';
  name?: string;

  options: {
    /** Interface this route belongs to. */
    interface?: string;
    /** Destination network. */
    target?: string;
    /** Netmask. */
    netmask?: string;
    /** Gateway. */
    gateway?: string;
    /** Metric. */
    metric?: string | number;
    /** MTU for this route. */
    mtu?: string | number;
    /** Route source. */
    source?: string;
    /** Table. */
    table?: string;
  };
};

export type UciNetworkRule = {
  type: 'rule';
  name?: string;

  options: {
    /** Interface this rule belongs to. */
    interface?: string;
    /** Source address/range. */
    src?: string;
    /** Destination address/range. */
    dest?: string;
    /** IP family: inet, inet6. */
    family?: string;
    /** Rule priority. */
    priority?: string | number;
    /** Tos value. */
    tos?: string | number;
    /** Fwmark. */
    fwmark?: string;
    /** Lookup table. */
    lookup?: string;
    /** Action: prohibit, unreachable, blackhole. */
    action?: string;
    /** Suppress prefix length. */
    suppress_prefixlength?: string | number;
  };
};

export type UciNetworkBridgeVlan = {
  type: 'bridge-vlan';
  name?: string;

  options: {
    /** Bridge device name. */
    device?: string;
    /** VLAN ID. */
    vlan?: string | number;
  };
  lists?: {
    /** Ports with tagging flags (e.g. lan1:u*, cpu:t). */
    ports?: string[];
  };
};
