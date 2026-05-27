/**
 * @module systemd/networkd/link
 *
 * Type definitions for systemd-networkd configuration files.
 *
 * @see systemd.link(5) - Network device configuration
 */

/**
 * [Match] section for .link files.
 * Determines if a link file may be applied to a given device.
 */
export type LinkMatch = {
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
    /** Whitespace-separated list of shell-style globs matching the original device name (udev INTERFACE). */
    OriginalName?: string;
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
 * [Link] section for .link files.
 * Configures network device settings.
 */
export type LinkLink = {
  Link: {
    /** Description of the device. */
    Description?: string;
    /** Set udev properties. Space-separated "KEY=VALUE" pairs. Supports specifier expansion. */
    Property?: string | string[];
    /** Import udev properties from the saved database. Space-separated property names. */
    ImportProperty?: string | string[];
    /** Unset udev properties. Space-separated property names. Applied after ImportProperty= and Property=. */
    UnsetProperty?: string | string[];
    /** Set the ifalias interface property. */
    Alias?: string;
    /** Policy for MAC address assignment. "persistent" uses hardware or generates stable, "random" generates new each boot, "none" keeps kernel-assigned. */
    MACAddressPolicy?: 'persistent' | 'random' | 'none';
    /** Interface MAC address to use. Requires MACAddressPolicy=none or unset. */
    MACAddress?: string;
    /** Ordered list of naming policies. First successful one is used. Disabled by net.ifnames=0. */
    NamePolicy?: string;
    /** Interface name to use. Lower precedence than NamePolicy=. 1-15 characters, no ":", "/", "%". */
    Name?: string;
    /** Space-separated list of policies for alternative interface names. All successful policies are used. */
    AlternativeNamesPolicy?: string;
    /** Alternative interface name to use. Can be specified multiple times. Max 127 characters. */
    AlternativeName?: string | string[];
    /** Number of transmit queues (1-4096). */
    TransmitQueues?: number;
    /** Number of receive queues (1-4096). */
    ReceiveQueues?: number;
    /** Transmit queue length in packets (0-4294967294). */
    TransmitQueueLength?: number;
    /** Maximum transmission unit in bytes. Suffixes K, M, G supported (base 1024). */
    MTUBytes?: string;
    /** Device speed, rounded down to nearest Mbps. Suffixes K, M, G supported (base 1000). */
    BitsPerSecond?: string;
    /** Duplex mode. */
    Duplex?: 'half' | 'full';
    /** Enable automatic negotiation of transmission parameters. */
    AutoNegotiation?: boolean;
    /** Wake-on-LAN policy. "off" or space-separated list of: phy, unicast, multicast, broadcast, arp, magic, secureon. */
    WakeOnLan?: string;
    /** SecureOn password for MagicPacket. 6 bytes in hex format with colons, or path to file/socket. */
    WakeOnLanPassword?: string;
    /** Device port type. */
    Port?: 'tp' | 'aui' | 'bnc' | 'mii' | 'fibre';
    /** Speeds/duplex modes advertised for auto-negotiation. Implies AutoNegotiation=yes. */
    Advertise?: string | string[];
    /** Enable hardware offload for checksumming of ingress packets. */
    ReceiveChecksumOffload?: boolean;
    /** Enable hardware offload for checksumming of egress packets. */
    TransmitChecksumOffload?: boolean;
    /** Enable scatter-gather offload (build packet from multiple non-contiguous buffers). */
    ScatterGather?: boolean;
    /** Enable scatter-gather fraglist offload (build packet from chained socket buffers). */
    ScatterGatherFragmentList?: boolean;
    /** Enable TCP Segmentation Offload (TSO). */
    TCPSegmentationOffload?: boolean;
    /** Enable TSO even when ECN flags are active. */
    TCPECNSegmentationOffload?: boolean;
    /** Enable TSO even if hardware can't increment IPv4 ID field. */
    TCPMangleIdSegmentationOffload?: boolean;
    /** Enable TCP6 Segmentation Offload. */
    TCP6SegmentationOffload?: boolean;
    /** Enable Generic Segmentation Offload (GSO). */
    GenericSegmentationOffload?: boolean;
    /** Enable Partial GSO. */
    PartialGenericSegmentationOffload?: boolean;
    /** Enable Generic Receive Offload (GRO). */
    GenericReceiveOffload?: boolean;
    /** Enable hardware accelerated GRO. */
    GenericReceiveOffloadHardware?: boolean;
    /** Enable GRO List for UDP. */
    GenericReceiveOffloadList?: boolean;
    /** Enable GRO for aggregating incoming UDP packets. */
    GenericReceiveOffloadUDPForwarding?: boolean;
    /** Enable Large Receive Offload (LRO). */
    LargeReceiveOffload?: boolean;
    /** CPUs for Receive Packet Steering (RPS). List of indices/ranges or "all". "disable" to turn off. */
    ReceivePacketSteeringCPUMask?: string;
    /** Enable receive VLAN CTAG hardware acceleration. */
    ReceiveVLANCTAGHardwareAcceleration?: boolean;
    /** Enable transmit VLAN CTAG hardware acceleration. */
    TransmitVLANCTAGHardwareAcceleration?: boolean;
    /** Enable receive filtering on VLAN CTAGs. */
    ReceiveVLANCTAGFilter?: boolean;
    /** Enable transmit VLAN STAG hardware acceleration. */
    TransmitVLANSTAGHardwareAcceleration?: boolean;
    /** Enable receive N-tuple filters and actions. */
    NTupleFilter?: boolean;
    /** Pass FCS value up the stack without trimming. */
    ReceiveFCS?: boolean;
    /** Allow interface to receive damaged ethernet frames. */
    ReceiveAll?: boolean;
    /** Number of receive channels (1-4294967295) or "max" for hardware maximum. */
    RxChannels?: number | 'max';
    /** Number of transmit channels (1-4294967295) or "max" for hardware maximum. */
    TxChannels?: number | 'max';
    /** Number of other channels (1-4294967295) or "max" for hardware maximum. */
    OtherChannels?: number | 'max';
    /** Number of combined channels (1-4294967295) or "max" for hardware maximum. */
    CombinedChannels?: number | 'max';
    /** Max pending packets in NIC receive buffer (1-4294967295) or "max". */
    RxBufferSize?: number | 'max';
    /** Max pending packets in NIC mini receive buffer (1-4294967295) or "max". */
    RxMiniBufferSize?: number | 'max';
    /** Max pending packets in NIC jumbo receive buffer (1-4294967295) or "max". */
    RxJumboBufferSize?: number | 'max';
    /** Max pending packets in NIC transmit buffer (1-4294967295) or "max". */
    TxBufferSize?: number | 'max';
    /** Enable receive flow control (generate/send PAUSE frames). */
    RxFlowControl?: boolean;
    /** Enable transmit flow control (respond to PAUSE frames). */
    TxFlowControl?: boolean;
    /** Enable auto-negotiation of PAUSE configuration. */
    AutoNegotiationFlowControl?: boolean;
    /** Maximum GSO packet size. Suffixes K, M, G supported (1-65536). */
    GenericSegmentOffloadMaxBytes?: string;
    /** Maximum number of GSO segments (1-65535). */
    GenericSegmentOffloadMaxSegments?: number;
    /** Enable/disable adaptive Rx coalescing. */
    UseAdaptiveRxCoalesce?: boolean;
    /** Enable/disable adaptive Tx coalescing. */
    UseAdaptiveTxCoalesce?: boolean;
    /** Delay before Rx interrupt after packet received. */
    RxCoalesceSec?: string;
    /** Delay before Rx IRQ interrupt after packet received. */
    RxCoalesceIrqSec?: string;
    /** Delay before Rx interrupt in low packet rate mode. */
    RxCoalesceLowSec?: string;
    /** Delay before Rx interrupt in high packet rate mode. */
    RxCoalesceHighSec?: string;
    /** Delay before Tx interrupt after packet sent. */
    TxCoalesceSec?: string;
    /** Delay before Tx IRQ interrupt after packet sent. */
    TxCoalesceIrqSec?: string;
    /** Delay before Tx interrupt in low packet rate mode. */
    TxCoalesceLowSec?: string;
    /** Delay before Tx interrupt in high packet rate mode. */
    TxCoalesceHighSec?: string;
    /** Max frames before Rx interrupt is generated. */
    RxMaxCoalescedFrames?: number;
    /** Max frames before Rx IRQ interrupt is generated. */
    RxMaxCoalescedIrqFrames?: number;
    /** Max frames before Rx interrupt in low rate mode. */
    RxMaxCoalescedLowFrames?: number;
    /** Max frames before Rx interrupt in high rate mode. */
    RxMaxCoalescedHighFrames?: number;
    /** Max frames before Tx interrupt is generated. */
    TxMaxCoalescedFrames?: number;
    /** Max frames before Tx IRQ interrupt is generated. */
    TxMaxCoalescedIrqFrames?: number;
    /** Max frames before Tx interrupt in low rate mode. */
    TxMaxCoalescedLowFrames?: number;
    /** Max frames before Tx interrupt in high rate mode. */
    TxMaxCoalescedHighFrames?: number;
    /** Low packet rate threshold (packets/sec) for adaptive coalescing. */
    CoalescePacketRateLow?: number;
    /** High packet rate threshold (packets/sec) for adaptive coalescing. */
    CoalescePacketRateHigh?: number;
    /** How often to sample packet rate for adaptive coalescing. Cannot be zero. */
    CoalescePacketRateSampleIntervalSec?: string;
    /** Delay for driver in-memory statistics block updates. Cannot be zero. */
    StatisticsBlockCoalesceSec?: string;
    /** Medium dependent interface mode. "straight"/"mdi", "crossover"/"mdi-x"/"mdix", or "auto". */
    MDI?: 'straight' | 'mdi' | 'crossover' | 'mdi-x' | 'mdix' | 'auto';
    /** Number of SR-IOV virtual functions (0-2147483647). */
    SRIOVVirtualFunctions?: number;
  };
};

/**
 * [SR-IOV] section for .link files.
 * Configures SR-IOV virtual functions.
 */
export type LinkSRIOV = {
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
    MACSpoofCheck?: boolean;
    /** Toggle ability to query RSS configuration of the VF. */
    QueryReceiveSideScaling?: boolean;
    /** Set trust mode of the VF. When set, VF users can set features impacting security/performance. */
    Trust?: boolean;
    /** Link state of the VF. "auto" reflects PF state, "yes" allows VF communication even if PF is down, "no" drops VF packets. */
    LinkState?: boolean | 'auto';
    /** MAC address for the virtual function. */
    MACAddress?: string;
  };
};

/**
 * [EnergyEfficientEthernet] section for .link files.
 * Configures Energy Efficient Ethernet (EEE) settings.
 */
export type LinkEnergyEfficientEthernet = {
  EnergyEfficientEthernet: {
    /** Enable Energy Efficient Ethernet feature. */
    Enable?: boolean;
    /** Enable transmit Low Power Idle (Tx-LPI) mode. */
    TxLowPowerIdle?: boolean;
    /** How long the interface should not enter Low Power Idle mode after transmission. */
    TxLowPowerIdleSec?: string;
    /** EEE-capable connection modes to advertise. See Advertise= values table. */
    LinkMode?: string | string[];
  };
};
