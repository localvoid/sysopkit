---
title: networkd
description: systemd-networkd configuration types (.link, .network, .netdev).
---

Type definitions for systemd-networkd configuration files: `.link`, `.network`, and `.netdev` files.

```ts
import type { LinkMatch, LinkLink, LinkSRIOV } from '@sysopkit/linux/systemd/networkd/link';

import type {
  NetworkConf,
  NetworkMatch,
  NetworkLink,
  NetworkNetwork,
  NetworkAddress,
  NetworkRoute,
  NetworkDHCPv4,
  NetworkDHCPv6,
  NetworkBridgePort,
} from '@sysopkit/linux/systemd/networkd/network';

import type {
  NetDevConf,
  NetDevBridge,
  NetDevVLAN,
  NetDevVXLAN,
  NetDevTunnel,
  NetDevWireGuard,
  NetDevWireGuardPeer,
  NetDevBond,
} from '@sysopkit/linux/systemd/networkd/netdev';
```

## Link Files (`.link`)

Device-level configuration applied by udev during device initialization.

```ts
type LinkConf = Partial<LinkMatch> & Partial<LinkLink> & Partial<LinkSRIOV>;
```

### LinkMatch

```ts
type LinkMatch = {
  Match: {
    MACAddress?: string;
    PermanentMACAddress?: string;
    Path?: string;
    Driver?: string;
    Type?: string;
    Kind?: string;
    Property?: string;
    OriginalName?: string;
    Host?: string;
    Virtualization?: string;
    KernelCommandLine?: string;
    KernelVersion?: string;
    Architecture?: string;
    Firmware?: string;
  };
};
```

### LinkLink

```ts
type LinkLink = {
  Link: {
    MACAddress?: string;
    MTUBytes?: string;
    MTUBytesForDHCP?: string;
    BitsPerSecond?: string;
    Duplex?: 'half' | 'full';
    AutoNegotiation?: 'yes' | 'no';
    WakeOnLan?: string;
    Port?: string;
    NamePolicy?: string;
    Name?: string;
    Alias?: string;
    RequiredForOnline?: 'yes' | 'no';
  };
};
```

## Network Files (`.network`)

Interface-level network configuration.

```ts
type NetworkConf = Partial<NetworkMatch> &
  Partial<NetworkLink> &
  Partial<NetworkSRIOV> &
  NetworkNetwork &
  Partial<NetworkAddress> &
  Partial<NetworkNeighbor> &
  Partial<NetworkRoute> &
  Partial<NetworkDHCPv4> &
  Partial<NetworkDHCPv6> &
  Partial<NetworkBridgePort> &
  Partial<NetworkIPv6AcceptRA> &
  Partial<NetworkDHCPServer> &
  Partial<NetworkIPv6SendRA>;
```

### NetworkMatch

Same as `LinkMatch` with additional `MACAddress` match support.

### NetworkNetwork

```ts
type NetworkNetwork = {
  Network: {
    DHCP?: 'yes' | 'no' | 'ipv4' | 'ipv6';
    DHCPServer?: 'yes' | 'no';
    LinkLocalAddressing?: 'yes' | 'no' | 'ipv4' | 'ipv6';
    IPv6AcceptRA?: 'yes' | 'no';
    BindCarrier?: string;
    Address?: string | string[];
    Gateway?: string;
    DNS?: string | string[];
    Domains?: string;
    NTP?: string | string[];
    VLAN?: string[];
    Bridge?: string[];
    Bond?: string[];
    IPForward?: 'yes' | 'no' | 'ipv4' | 'ipv6';
  };
};
```

## NetDev Files (`.netdev`)

Virtual network device creation.

```ts
type NetDevConf = Partial<NetDevMatch> &
  NetDevNetDev &
  Partial<NetDevBridge> &
  Partial<NetDevVLAN> &
  Partial<NetDevVXLAN> &
  Partial<NetDevTunnel> &
  Partial<NetDevWireGuard> &
  Partial<NetDevWireGuardPeer> &
  Partial<NetDevBond> &
  Partial<NetDevMACVLAN> &
  Partial<NetDevIPVLAN> &
  Partial<NetDevGENEVE> &
  Partial<NetDevVRF> &
  Partial<NetDevBatmanAdvanced>;
```

### Supported Virtual Device Types

| Type             | Config Section                   | Description                    |
| ---------------- | -------------------------------- | ------------------------------ |
| Bridge           | `NetDevBridge`                   | Ethernet bridge                |
| Bond             | `NetDevBond`                     | Link aggregation               |
| VLAN             | `NetDevVLAN`                     | 802.1Q VLAN                    |
| MACVLAN / IPVLAN | `NetDevMACVLAN` / `NetDevIPVLAN` | Virtual interfaces             |
| VXLAN            | `NetDevVXLAN`                    | VXLAN tunnel                   |
| Geneve           | `NetDevGENEVE`                   | Geneve tunnel                  |
| Tunnel           | `NetDevTunnel`                   | IP tunnels (GRE, IPIP, etc.)   |
| WireGuard        | `NetDevWireGuard`                | WireGuard VPN                  |
| VRF              | `NetDevVRF`                      | Virtual routing and forwarding |
| MACsec           | `NetDevMACsec`                   | MAC-level encryption           |
| Xfrm             | `NetDevXfrm`                     | IPsec virtual interface        |
