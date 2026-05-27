/**
 * @module systemd/networkd/netdev
 *
 * Type definitions for systemd-networkd configuration files.
 *
 * @see systemd.netdev(5) - Virtual Network Device configuration
 */

export type NetDevConf = Partial<NetDevMatch> &
  NetDevNetDev &
  Partial<NetDevBridge> &
  Partial<NetDevVLAN> &
  Partial<NetDevMACVLAN> &
  Partial<NetDevMACVTAP> &
  Partial<NetDevIPVLAN> &
  Partial<NetDevIPVTAP> &
  Partial<NetDevVXLAN> &
  Partial<NetDevGENEVE> &
  Partial<NetDevHSR> &
  Partial<NetDevBAREUDP> &
  Partial<NetDevL2TP> &
  Partial<NetDevL2TPSession> &
  Partial<NetDevMACsec> &
  Partial<NetDevMACsecTransmitAssociation> &
  Partial<NetDevMACsecReceiveAssociation> &
  Partial<NetDevTunnel> &
  Partial<NetDevFooOverUDP> &
  Partial<NetDevPeer> &
  Partial<NetDevVXCAN> &
  Partial<NetDevTun> &
  Partial<NetDevTap> &
  Partial<NetDevWireGuard> &
  Partial<NetDevWireGuardPeer> &
  Partial<NetDevBond> &
  Partial<NetDevXfrm> &
  Partial<NetDevVRF> &
  Partial<NetDevBatmanAdvanced> &
  Partial<NetDevIPOIB> &
  Partial<NetDevWLAN>;

/**
 * [Match] section for .netdev files.
 * Determines if a virtual network device should be created.
 */
export type NetDevMatch = {
  Match: {
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
 * [NetDev] section for .netdev files.
 * Defines the virtual network device.
 */
export type NetDevNetDev = {
  NetDev: {
    /** Free-form description of the netdev. */
    Description?: string;
    /** Interface name for the netdev. Compulsory. */
    Name: string;
    /** Netdev kind. Compulsory. */
    Kind:
      | 'bond'
      | 'bridge'
      | 'dummy'
      | 'gre'
      | 'gretap'
      | 'erspan'
      | 'ip6gre'
      | 'ip6tnl'
      | 'ip6gretap'
      | 'ipip'
      | 'ipvlan'
      | 'ipvtap'
      | 'macvlan'
      | 'macvtap'
      | 'sit'
      | 'tap'
      | 'tun'
      | 'veth'
      | 'vlan'
      | 'vti'
      | 'vti6'
      | 'vxlan'
      | 'geneve'
      | 'hsr'
      | 'l2tp'
      | 'macsec'
      | 'vrf'
      | 'vcan'
      | 'vxcan'
      | 'wireguard'
      | 'nlmon'
      | 'fou'
      | 'xfrm'
      | 'ifb'
      | 'bareudp'
      | 'batadv'
      | 'ipoib'
      | 'wlan';
    /** Maximum transmission unit in bytes. Suffixes K, M, G supported (base 1024). */
    MTUBytes?: number | string;
    /** MAC address to use, or "none" for random. */
    MACAddress?: string;
  };
};

/**
 * [Bridge] section for .netdev files.
 * Configures bridge device settings.
 */
export type NetDevBridge = {
  Bridge: {
    /** Seconds between hello packets from root/designated bridges. */
    HelloTimeSec?: string;
    /** Maximum message age in seconds before takeover procedure. */
    MaxAgeSec?: string;
    /** Seconds spent in Listening/Learning states before Forwarding. */
    ForwardDelaySec?: string;
    /** Seconds a MAC address is kept in the forwarding database. */
    AgeingTimeSec?: string;
    /** Bridge priority (0-65535). Lower value = higher priority. */
    Priority?: number;
    /** 16-bit bitmask for forwarding link local frames with 802.1D reserved addresses (01:80:C2:00:00:0X). */
    GroupForwardMask?: number;
    /** Default port VLAN ID (1-4094) or "none" to disable. */
    DefaultPVID?: number | 'none';
    /** Controls IFLA_BR_MCAST_QUERIER. */
    MulticastQuerier?: 'on' | 'off';
    /** Controls IFLA_BR_MCAST_SNOOPING. */
    MulticastSnooping?: 'on' | 'off';
    /** Controls IFLA_BR_VLAN_FILTERING. */
    VLANFiltering?: 'on' | 'off';
    /** VLAN protocol for the bridge. */
    VLANProtocol?: '802.1q' | '802.1ad';
    /** Enable Spanning Tree Protocol. */
    STP?: 'on' | 'off';
    /** IGMP version for multicast snooping (2 or 3). */
    MulticastIGMPVersion?: 2 | 3;
    /** Maximum learned Ethernet addresses. 0 disables limit. */
    FDBMaxLearned?: number;
    /** Learn source addresses from link local frames. */
    LinkLocalLearning?: 'on' | 'off';
  };
};

/**
 * [VLAN] section for .netdev files.
 * Configures VLAN device settings.
 */
export type NetDevVLAN = {
  VLAN: {
    /** VLAN ID (0-4094). Compulsory. */
    Id: number;
    /** VLAN protocol. */
    Protocol?: '802.1q' | '802.1ad';
    /** Enable Generic VLAN Registration Protocol. */
    GVRP?: 'on' | 'off';
    /** Enable Multiple VLAN Registration Protocol. */
    MVRP?: 'on' | 'off';
    /** Only operational state is passed from parent device. */
    LooseBinding?: 'on' | 'off';
    /** Use VLAN reorder header. */
    ReorderHeader?: 'on' | 'off';
    /** Whitespace-separated list of "from-to" integer pairs mapping SO_PRIORITY to VLAN PCP field (egress). */
    EgressQOSMaps?: string | string[];
    /** Whitespace-separated list of "from-to" integer pairs mapping SO_PRIORITY to VLAN PCP field (ingress). */
    IngressQOSMaps?: string | string[];
  };
};

/**
 * [MACVLAN] section for .netdev files.
 * Configures MACVLAN device settings.
 */
export type NetDevMACVLAN = {
  MACVLAN: {
    /** MACVLAN mode. "private" isolates, "vepa" uses external switch, "bridge" allows direct communication, "passthru" gives full access, "source" filters by source MAC. */
    Mode?: 'private' | 'vepa' | 'bridge' | 'passthru' | 'source';
    /** Whitespace-separated list of remote MAC addresses (used in source mode). */
    SourceMACAddress?: string | string[];
    /** Receive queue length for broadcast/multicast (0-4294967294). */
    BroadcastMulticastQueueLength?: number;
    /** Broadcast queue threshold. "no" or integer (0-2147483647). */
    BroadcastQueueThreshold?: 'no' | number;
  };
};

/**
 * [MACVTAP] section for .netdev files.
 * Same keys as [MACVLAN], but accessible via tap user space interface.
 */
export type NetDevMACVTAP = {
  MACVTAP: {
    /** MACVTAP mode. "private" isolates, "vepa" uses external switch, "bridge" allows direct communication, "passthru" gives full access, "source" filters by source MAC. */
    Mode?: 'private' | 'vepa' | 'bridge' | 'passthru' | 'source';
    /** Whitespace-separated list of remote MAC addresses (used in source mode). */
    SourceMACAddress?: string | string[];
    /** Receive queue length for broadcast/multicast (0-4294967294). */
    BroadcastMulticastQueueLength?: number;
    /** Broadcast queue threshold. "no" or integer (0-2147483647). */
    BroadcastQueueThreshold?: 'no' | number;
  };
};

/**
 * [IPVLAN] section for .netdev files.
 * Configures IPVLAN device settings.
 */
export type NetDevIPVLAN = {
  IPVLAN: {
    /** IPVLAN mode. "L2" for L2 switching, "L3" for L3 routing, "L3S" for L3 switching. */
    Mode?: 'L2' | 'L3' | 'L3S';
    /** IPVLAN flags. "bridge" for bridge mode, "private" for isolation, "vepa" for VEPA mode. */
    Flags?: 'bridge' | 'private' | 'vepa';
  };
};

/**
 * [IPVTAP] section for .netdev files.
 * Same keys as [IPVLAN], but accessible via tap user space interface.
 */
export type NetDevIPVTAP = {
  IPVTAP: {
    /** IPVTAP mode. "L2" for L2 switching, "L3" for L3 routing, "L3S" for L3 switching. */
    Mode?: 'L2' | 'L3' | 'L3S';
    /** IPVTAP flags. "bridge" for bridge mode, "private" for isolation, "vepa" for VEPA mode. */
    Flags?: 'bridge' | 'private' | 'vepa';
  };
};

/**
 * [VXLAN] section for .netdev files.
 * Configures VXLAN device settings.
 */
export type NetDevVXLAN = {
  VXLAN: {
    /** VXLAN Network Identifier (1-16777215). Ignored if External=yes. */
    VNI?: number;
    /** Destination IP address. */
    Remote?: string;
    /** Local IP address, or "ipv4_link_local", "ipv6_link_local", "dhcp4", "dhcp6", "slaac". */
    Local?: string;
    /** Multicast group IP address. */
    Group?: string;
    /** Type Of Service byte value. */
    TOS?: number;
    /** TTL value. "inherit" uses inner packet TTL, 0 also means inherit. */
    TTL?: 'inherit' | number;
    /** Enable dynamic MAC learning. */
    MacLearning?: 'on' | 'off';
    /** Lifetime of FDB entries in seconds. */
    FDBAgeingSec?: number;
    /** Maximum FDB entries. */
    MaximumFDBEntries?: number;
    /** Bridge-connected VXLAN answers ARP on behalf of remote DOVE clients. */
    ReduceARPProxy?: 'on' | 'off';
    /** Enable netlink LLADDR miss notifications. */
    L2MissNotification?: 'on' | 'off';
    /** Enable netlink IP address miss notifications. */
    L3MissNotification?: 'on' | 'off';
    /** Enable route short circuiting. */
    RouteShortCircuit?: 'on' | 'off';
    /** Enable UDP checksums for VXLAN/IPv4. */
    UDPChecksum?: 'on' | 'off';
    /** Enable zero checksums in VXLAN/IPv6 TX. */
    UDP6ZeroChecksumTx?: 'on' | 'off';
    /** Enable zero checksums in VXLAN/IPv6 RX. */
    UDP6ZeroChecksumRx?: 'on' | 'off';
    /** Enable remote TX checksum offload. */
    RemoteChecksumTx?: 'on' | 'off';
    /** Enable remote RX checksum offload. */
    RemoteChecksumRx?: 'on' | 'off';
    /** Enable Group Policy VXLAN extension. */
    GroupPolicyExtension?: 'on' | 'off';
    /** Enable Generic Protocol Extension. */
    GenericProtocolExtension?: 'on' | 'off';
    /** Destination UDP port. Default 4789 (IANA). */
    DestinationPort?: number;
    /** Source UDP port range. */
    PortRange?: string;
    /** IPv6 flow label (0-1048575). */
    FlowLabel?: number;
    /** Set IPv4 DF bit. "inherit" uses inner packet's DF bit. */
    IPDoNotFragment?: 'on' | 'off' | 'inherit';
    /** Create without underlying interface. */
    Independent?: 'on' | 'off';
    /** Externally controlled (e.g., EVPN). */
    External?: 'on' | 'off';
    /** Enable VNI filtering capability. Requires External=true. */
    VNIFilter?: 'on' | 'off';
  };
};

/**
 * [GENEVE] section for .netdev files.
 * Configures GENEVE device settings.
 */
export type NetDevGENEVE = {
  GENEVE: {
    /** Virtual Network Identifier (0-16777215). Mandatory. */
    Id: number;
    /** Unicast destination IP address. */
    Remote?: string;
    /** TOS value (1-255). */
    TOS?: number;
    /** TTL value. "inherit" uses inner packet TTL. Default from ip_default_ttl. */
    TTL?: 'inherit' | number;
    /** Enable UDP checksum for IPv4. */
    UDPChecksum?: 'on' | 'off';
    /** Skip UDP checksum for IPv6 TX. */
    UDP6ZeroChecksumTx?: 'on' | 'off';
    /** Allow zero checksum IPv6 RX. */
    UDP6ZeroChecksumRx?: 'on' | 'off';
    /** Destination UDP port. Default 6081. */
    DestinationPort?: number;
    /** IPv6 flow label. */
    FlowLabel?: number;
    /** Set IPv4 DF bit. "inherit" uses inner packet's DF bit. */
    IPDoNotFragment?: 'on' | 'off' | 'inherit';
    /** Use inner L3 protocol as Protocol Type. */
    InheritInnerProtocol?: 'on' | 'off';
  };
};

/**
 * [HSR] section for .netdev files.
 * Configures HSR/PRP device settings (High-availability Seamless Redundancy).
 */
export type NetDevHSR = {
  HSR: {
    /** Exactly two interface names for HSR/PRP. Mandatory. */
    Ports: string;
    /** Protocol. "hsr" for High-availability Seamless Redundancy, "prp" for Parallel Redundancy Protocol. */
    Protocol?: 'hsr' | 'prp';
    /** Last byte of destination MAC for supervision frames (0-255). Default 0. */
    Supervision?: number;
  };
};

/**
 * [BAREUDP] section for .netdev files.
 * Configures BareUDP tunnel settings (generic L3 encapsulation over UDP).
 */
export type NetDevBAREUDP = {
  BAREUDP: {
    /** UDP destination port (1-65535). Mandatory. */
    DestinationPort: number;
    /** EtherType for encapsulated protocol. Mandatory. */
    EtherType: 'ipv4' | 'ipv6' | 'mpls-uc' | 'mpls-mc';
    /** Lowest UDP source port (1-65535). */
    MinSourcePort?: number;
  };
};

/**
 * [L2TP] section for .netdev files.
 * Configures L2TP tunnel settings.
 */
export type NetDevL2TP = {
  L2TP: {
    /** Tunnel identifier (1-4294967295). Must match peer's PeerTunnelId. Compulsory. */
    TunnelId: number;
    /** Peer tunnel ID (1-4294967295). Must match peer's TunnelId. Compulsory. */
    PeerTunnelId: number;
    /** Remote peer IP address. Compulsory. */
    Remote: string;
    /** Local IP address, or "auto", "static", "dynamic". Optionally "@interface". Default "auto". */
    Local?: string;
    /** Encapsulation type. */
    EncapsulationType?: 'udp' | 'ip';
    /** UDP source port. Mandatory for UDP encapsulation. */
    UDPSourcePort?: number;
    /** UDP destination port. Mandatory for UDP encapsulation. */
    UDPDestinationPort?: number;
    /** Enable UDP checksum for IPv4. */
    UDPChecksum?: 'on' | 'off';
    /** Skip UDP checksum for IPv6 TX. */
    UDP6ChecksumTx?: 'on' | 'off';
    /** Allow zero checksum IPv6 RX. */
    UDP6ChecksumRx?: 'on' | 'off';
  };
};

/**
 * [L2TPSession] section for .netdev files.
 * Configures L2TP session settings.
 */
export type NetDevL2TPSession = {
  L2TPSession: {
    /** Session name. Compulsory. */
    Name: string;
    /** Session identifier (1-4294967295). Compulsory. */
    SessionId: number;
    /** Peer session identifier (1-4294967295). Compulsory. */
    PeerSessionId: number;
    /** Layer 2 specific header type. */
    Layer2SpecificHeader?: 'none' | 'default';
  };
};

/**
 * [MACsec] section for .netdev files.
 * Configures MACsec device settings (IEEE 802.1AE).
 */
export type NetDevMACsec = {
  MACsec: {
    /** Port number for MACsec transmit channel (1-65535). */
    Port?: number;
    /** Enable encryption. */
    Encrypt?: 'on' | 'off';
  };
};

/**
 * [MACsecReceiveChannel] section for .netdev files.
 * Configures MACsec receive channel.
 */
export type NetDevMACsecReceiveChannel = {
  MACsecReceiveChannel: {
    /** Port number for MACsec receive channel (1-65535). Compulsory. */
    Port: number;
    /** MAC address for SCI. Compulsory. */
    MACAddress: string;
  };
};

/**
 * [MACsecTransmitAssociation] section for .netdev files.
 * Configures MACsec transmit association.
 */
export type NetDevMACsecTransmitAssociation = {
  MACsecTransmitAssociation: {
    /** Packet number (1-4294967295). */
    PacketNumber?: number;
    /** Key ID (0-255). Compulsory. */
    KeyId: number;
    /** 128-bit hex encryption key. Compulsory. */
    Key: string;
    /** Absolute path to file containing 128-bit hex key. */
    KeyFile?: string;
    /** Activate this security association. */
    Activate?: 'on' | 'off';
    /** Use this association for encoding. Only one section can enable this. */
    UseForEncoding?: 'on' | 'off';
  };
};

/**
 * [MACsecReceiveAssociation] section for .netdev files.
 * Configures MACsec receive association.
 */
export type NetDevMACsecReceiveAssociation = {
  MACsecReceiveAssociation: {
    /** Port number for MACsec receive channel (1-65535). Compulsory. */
    Port: number;
    /** MAC address for SCI. Compulsory. */
    MACAddress: string;
    /** Packet number (1-4294967295). */
    PacketNumber?: number;
    /** Key ID (0-255). Compulsory. */
    KeyId: number;
    /** 128-bit hex encryption key. Compulsory. */
    Key: string;
    /** Absolute path to file containing 128-bit hex key. */
    KeyFile?: string;
    /** Activate this security association. */
    Activate?: 'on' | 'off';
  };
};

/**
 * [Tunnel] section for .netdev files.
 * Configures tunnel device settings (ipip, sit, gre, gretap, ip6gre, ip6gretap, vti, vti6, ip6tnl, erspan).
 */
export type NetDevTunnel = {
  Tunnel: {
    /** Enable collect metadata mode. Implies Independent=. */
    External?: 'on' | 'off';
    /** Local address, or "any", "ipv4_link_local", "ipv6_link_local", "dhcp4", "dhcp6", "dhcp_pd", "slaac". Default "any". */
    Local?: string;
    /** Remote endpoint IP or "any". */
    Remote?: string;
    /** Type Of Service byte value. */
    TOS?: number;
    /** TTL (1-255). 0 means inherit. IPv4 default 0, IPv6 default 64. */
    TTL?: number;
    /** Enable Path MTU Discovery. */
    DiscoverPathMTU?: 'on' | 'off';
    /** Suppress IPv4 DF bit. GRE/GRETAP/ERSPAN only. */
    IgnoreDontFragment?: 'on' | 'off';
    /** IPv6 flow label (0-0xFFFFF) or "inherit". */
    IPv6FlowLabel?: string | number;
    /** Copy DSCP field during decapsulation. */
    CopyDSCP?: 'on' | 'off';
    /** Encapsulation levels permitted (0-255 or "none"). Default 4. */
    EncapsulationLimit?: number | 'none';
    /** Key for both directions (number or dotted quad). VTI/VTI6/GRE/GRETAP/ERSPAN. */
    Key?: string;
    /** Input key. */
    InputKey?: string;
    /** Output key. */
    OutputKey?: string;
    /** Tunnel mode. Depends on the Kind= setting. */
    Mode?: string;
    /** Create independently of any network. */
    Independent?: 'on' | 'off';
    /** Use lo as underlying device. */
    AssignToLoopback?: 'on' | 'off';
    /** Allow local remote endpoint on ip6tnl. */
    AllowLocalRemote?: 'on' | 'off';
    /** Enable FooOverUDP tunnel. IPIP/SIT/GRE/GRETAP only. */
    FooOverUDP?: 'on' | 'off';
    /** UDP destination port for FooOverUDP. Mandatory when FooOverUDP=yes. */
    FOUDestinationPort?: number;
    /** UDP source port for FooOverUDP. Default 0. */
    FOUSourcePort?: number;
    /** Same as [FooOverUDP] section. */
    Encapsulation?: string;
    /** ISP-specific IPv6 prefix for 6RD. SIT only. */
    IPv6RapidDeploymentPrefix?: string;
    /** Enable ISATAP tunnel. SIT only. */
    ISATAP?: 'on' | 'off';
    /** Serialize tunneled packets. GRE/GRETAP/ERSPAN only. */
    SerializeTunneledPackets?: 'on' | 'off';
    /** ERSPAN version. 0=type I, 1=type II, 2=type III. Default 1. */
    ERSPANVersion?: 0 | 1 | 2;
    /** ERSPAN v1 index (0-1048575). Default 0. */
    ERSPANIndex?: number;
    /** ERSPAN v2 direction. Default "ingress". */
    ERSPANDirection?: 'ingress' | 'egress';
    /** ERSPAN v2 engine ID (0-63). Default 0. */
    ERSPANHardwareId?: number;
  };
};

/**
 * [FooOverUDP] section for .netdev files.
 * Configures Foo-over-UDP tunnel settings.
 */
export type NetDevFooOverUDP = {
  FooOverUDP: {
    /** Encapsulation type. */
    Encapsulation?: 'FooOverUDP' | 'GenericUDPEncapsulation';
    /** Port number for encapsulated packets. Mandatory. */
    Port: number;
    /** Peer port number. */
    PeerPort?: number;
    /** Protocol name (e.g., "gre", "ipip") or integer (1-255). Mandatory for FooOverUDP. */
    Protocol?: string | number;
    /** Peer IP address. */
    Peer?: string;
    /** Local IP address. */
    Local?: string;
  };
};

/**
 * [Peer] section for .netdev files (veth).
 * Configures the veth peer.
 */
export type NetDevPeer = {
  Peer: {
    /** Interface name for the peer. Compulsory. */
    Name: string;
    /** MAC address for the peer. */
    MACAddress?: string;
  };
};

/**
 * [VXCAN] section for .netdev files.
 * Configures VXCAN peer (virtual CAN tunnel).
 */
export type NetDevVXCAN = {
  VXCAN: {
    /** Peer interface name. Compulsory. */
    Peer: string;
  };
};

/**
 * [Tun] section for .netdev files.
 * Configures TUN device settings (Level 3 tunnel).
 */
export type NetDevTun = {
  Tun: {
    /** Enable multiple file descriptors. */
    MultiQueue?: 'on' | 'off';
    /** Prepend 4 extra bytes with packet info. */
    PacketInfo?: 'on' | 'off';
    /** Enable IFF_VNET_HDR flag for GSO. */
    VNetHeader?: 'on' | 'off';
    /** User to grant access to /dev/net/tun. */
    User?: string;
    /** Group to grant access to /dev/net/tun. */
    Group?: string;
    /** Keep file descriptor open to maintain carrier state. */
    KeepCarrier?: 'on' | 'off';
  };
};

/**
 * [Tap] section for .netdev files.
 * Same keys as [Tun], but for Level 2 tunnel.
 */
export type NetDevTap = {
  Tap: {
    /** Enable multiple file descriptors. */
    MultiQueue?: 'on' | 'off';
    /** Prepend 4 extra bytes with packet info. */
    PacketInfo?: 'on' | 'off';
    /** Enable IFF_VNET_HDR flag for GSO. */
    VNetHeader?: 'on' | 'off';
    /** User to grant access to /dev/net/tun. */
    User?: string;
    /** Group to grant access to /dev/net/tun. */
    Group?: string;
    /** Keep file descriptor open to maintain carrier state. */
    KeepCarrier?: 'on' | 'off';
  };
};

/**
 * [WireGuard] section for .netdev files.
 * Configures WireGuard device settings.
 */
export type NetDevWireGuard = {
  WireGuard: {
    /** Base64 encoded private key. Falls back to credential "network.wireguard.private.<netdev>". Mandatory. */
    PrivateKey?: string;
    /** Absolute path to file containing Base64 encoded private key. */
    PrivateKeyFile?: string;
    /** UDP listening port (1-65535) or "auto". Default "auto". */
    ListenPort?: number | 'auto';
    /** Firewall mark (1-4294967295). */
    FirewallMark?: number;
    /** Route table for AllowedIPs routes. Falls back to networkd.conf(5) setting. */
    RouteTable?: string | number;
    /** Route priority for AllowedIPs routes. Default 0 (IPv4), 1024 (IPv6). */
    RouteMetric?: number;
  };
};

/**
 * [WireGuardPeer] section for .netdev files.
 * Configures WireGuard peer settings.
 */
export type NetDevWireGuardPeer = {
  WireGuardPeer: {
    /** Base64 encoded public key. Mandatory. */
    PublicKey: string;
    /** Absolute path to file containing Base64 encoded public key. */
    PublicKeyFile?: string;
    /** Optional preshared key (Base64). */
    PresharedKey?: string;
    /** Absolute path to file containing preshared key. */
    PresharedKeyFile?: string;
    /** Comma-separated list of allowed IP/CIDR ranges. */
    AllowedIPs?: string | string[];
    /** Endpoint IP/hostname:port. IPv6 in brackets. */
    Endpoint?: string;
    /** Persistent keepalive interval in seconds (1-65535) or "off"/0. */
    PersistentKeepalive?: number | 'off';
    /** Route table for this peer's AllowedIPs. Falls back to [WireGuard] section. */
    RouteTable?: string | number;
    /** Route priority for this peer's AllowedIPs. Falls back to [WireGuard] section. */
    RouteMetric?: number;
  }[];
};

/**
 * [Bond] section for .netdev files.
 * Configures bond device settings.
 */
export type NetDevBond = {
  Bond: {
    /** Bonding mode. */
    Mode?:
      | 'balance-rr'
      | 'active-backup'
      | 'balance-xor'
      | 'broadcast'
      | '802.3ad'
      | 'balance-tlb'
      | 'balance-alb';
    /** Transmit hash policy for load balancing. */
    TransmitHashPolicy?: 'layer2' | 'layer3+4' | 'layer2+3' | 'encap2+3' | 'encap3+4';
    /** LACP transmit rate. "slow" every 30s, "fast" every 1s. */
    LACPTransmitRate?: 'slow' | 'fast';
    /** MII link monitoring frequency. Default 0 (disabled). */
    MIIMonitorSec?: string;
    /** Delay between peer notifications after failover (0-300s). Default matches MIIMonitorSec. */
    PeerNotifyDelaySec?: string;
    /** Delay before link is enabled after up detection. Default 0. */
    UpDelaySec?: string;
    /** Delay before link is disabled after down detection. Default 0. */
    DownDelaySec?: string;
    /** Seconds between learning packets (1-0x7fffffff). Default 1. balance-tlb/balance-alb only. */
    LearnPacketIntervalSec?: number;
    /** 802.3ad aggregation selection logic. */
    AdSelect?: 'stable' | 'bandwidth' | 'count';
    /** 802.3ad actor system priority (1-65535). */
    AdActorSystemPriority?: number;
    /** 802.3ad user port key (0-1023). */
    AdUserPortKey?: number;
    /** 802.3ad system MAC address. */
    AdActorSystem?: string;
    /** Policy for selecting active MAC address after failover. */
    FailOverMACPolicy?: 'none' | 'active' | 'follow';
    /** ARP validation mode. */
    ARPValidate?: 'none' | 'active' | 'backup' | 'all';
    /** ARP monitoring frequency. Default 0 (disabled). */
    ARPIntervalSec?: string;
    /** IP addresses for ARP monitoring (max 16). */
    ARPIPTargets?: string | string[];
    /** ARP target mode. "any" considers any target up, "all" requires all targets up. */
    ARPAllTargets?: 'any' | 'all';
    /** Policy for reselecting primary slave. */
    PrimaryReselectPolicy?: 'always' | 'better' | 'failure';
    /** IGMP membership reports to send after failover (0-255). Default 1. */
    ResendIGMP?: number;
    /** Packets per slave before switching in balance-rr mode (0-65535). Default 1. */
    PacketsPerSlave?: number;
    /** Peer notifications after failover in active-backup mode (0-255). Default 1. */
    GratuitousARP?: number;
    /** Deliver duplicate frames from inactive slaves. */
    AllSlavesActive?: 'on' | 'off';
    /** Enable flow shuffling for balance-tlb mode. */
    DynamicTransmitLoadBalancing?: 'on' | 'off';
    /** Minimum active links for carrier. Default 0. */
    MinLinks?: number;
    /** Max missed ARP replies before link is considered down. */
    ARPMissedMax?: number;
  };
};

/**
 * [Xfrm] section for .netdev files.
 * Configures XFRM interface settings (virtual tunnel like vti/vti6).
 */
export type NetDevXfrm = {
  Xfrm: {
    /** XFRM interface ID (1-0xffffffff). Mandatory. */
    InterfaceId: number;
    /** Create independently of any network. */
    Independent?: 'on' | 'off';
  };
};

/**
 * [VRF] section for .netdev files.
 * Configures VRF (Virtual Routing and Forwarding) interface settings.
 */
export type NetDevVRF = {
  VRF: {
    /** Numeric routing table identifier. Compulsory. */
    Table: number;
  };
};

/**
 * [BatmanAdvanced] section for .netdev files.
 * Configures B.A.T.M.A.N. Advanced settings (mesh routing protocol).
 */
export type NetDevBatmanAdvanced = {
  BatmanAdvanced: {
    /** Gateway mode. */
    GatewayMode?: 'off' | 'server' | 'client';
    /** Enable packet aggregation. Default true. */
    Aggregation?: 'on' | 'off';
    /** Enable bridge loop avoidance. Default true. */
    BridgeLoopAvoidance?: 'on' | 'off';
    /** Enable distributed ARP table. Default true. */
    DistributedArpTable?: 'on' | 'off';
    /** Enable packet fragmentation. Default true. */
    Fragmentation?: 'on' | 'off';
    /** Hop penalty for OGM packets. Default 15. */
    HopPenalty?: number;
    /** Originator message flood interval. */
    OriginatorIntervalSec?: string;
    /** Download bandwidth (suffixes K/M/G/T). */
    GatewayBandwidthDown?: string;
    /** Upload bandwidth (suffixes K/M/G/T). */
    GatewayBandwidthUp?: string;
    /** Routing algorithm. */
    RoutingAlgorithm?: 'batman-v' | 'batman-iv';
  };
};

/**
 * [IPOIB] section for .netdev files.
 * Configures IP over Infiniband subinterface settings.
 */
export type NetDevIPOIB = {
  IPOIB: {
    /** Partition key (1-0xffff, except 0x8000). */
    PartitionKey?: number;
    /** IPoIB mode. */
    Mode?: 'datagram' | 'connected';
    /** Ignore userspace multicast groups. */
    IgnoreUserspaceMulticastGroups?: 'on' | 'off';
  };
};

/**
 * [WLAN] section for .netdev files.
 * Configures virtual WLAN interface settings.
 */
export type NetDevWLAN = {
  WLAN: {
    /** Physical WLAN device name or index. Mandatory. */
    PhysicalDevice: string;
    /** Wireless interface type. Mandatory. */
    Type:
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
    /** Enable Wireless Distribution System (4 address mode). */
    WDS?: 'on' | 'off';
  };
};
