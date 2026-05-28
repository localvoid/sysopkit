# @sysopkit/openwrt

Type-safe UCI (Unified Configuration Interface) type definitions and serialization for OpenWRT routers.

## Installation

```bash
bun add @sysopkit/openwrt
```

## Modules

### UCI Core

#### `@sysopkit/openwrt/uci`

Core UCI types and serializer.

```typescript
import { serializeUci, type UciConfig, type UciSection } from '@sysopkit/openwrt/uci';

const config: UciConfig<'interface' | 'device'> = [
  {
    type: 'interface',
    name: 'lan',
    options: {
      device: 'br-lan',
      proto: 'static',
      ipaddr: '192.168.1.1',
      netmask: '255.255.255.0',
    },
  },
  {
    type: 'device',
    name: 'br-lan',
    options: {
      type: 'bridge',
    },
    lists: {
      ports: ['lan1', 'lan2', 'lan3', 'lan4'],
    },
  },
];

const text = serializeUci(config);
// config interface 'lan'
//     option device 'br-lan'
//     option proto 'static'
//     option ipaddr '192.168.1.1'
//     option netmask '255.255.255.0'
//
// config device 'br-lan'
//     option type 'bridge'
//     list ports 'lan1'
//     list ports 'lan2'
//     list ports 'lan3'
//     list ports 'lan4'
```

- `serializeUci(config)` - Serializes a `UciConfig` into UCI text format

### Network

#### `@sysopkit/openwrt/uci/network`

Network interfaces, devices, routes, rules, and bridge VLANs (`/etc/config/network`).

```typescript
import type { UciNetwork, UciNetworkInterface, UciNetworkDevice } from '@sysopkit/openwrt/uci/network';

const config: UciNetwork = [
  {
    type: 'interface',
    name: 'lan',
    options: {
      device: 'br-lan',
      proto: 'static',
      ipaddr: '192.168.1.1',
      netmask: '255.255.255.0',
    },
  },
  {
    type: 'interface',
    name: 'wan',
    options: {
      device: 'eth0',
      proto: 'dhcp',
    },
  },
  {
    type: 'device',
    name: 'br-lan',
    options: {
      type: 'bridge',
      stp: '1',
      igmp_snooping: '1',
    },
    lists: {
      ports: ['lan1', 'lan2', 'lan3', 'lan4'],
    },
  },
];
```

**Types:**

- `UciNetworkInterface` - Interface config (static, dhcp, pppoe, wireguard, none)
- `UciNetworkDevice` - Physical/logical device (bridge, tunnel)
- `UciNetworkGlobals` - Global settings (ULA prefix, packet steering)
- `UciNetworkRoute` - Static routes
- `UciNetworkRule` - Routing policy rules
- `UciNetworkBridgeVlan` - Bridge VLAN configuration

### DHCP

#### `@sysopkit/openwrt/uci/dhcp`

DHCP and DNS server configuration (`/etc/config/dhcp`).

```typescript
import type { UciDhcp, UciDhcpDnsmasq, UciDhcpDhcp, UciDhcpHost } from '@sysopkit/openwrt/uci/dhcp';

const config: UciDhcp = [
  {
    type: 'dnsmasq',
    name: 'lan',
    options: {
      domainneeded: '1',
      local: '/lan/',
      domain: 'lan',
      expandhosts: '1',
      authoritative: '1',
    },
  },
  {
    type: 'dhcp',
    name: 'lan',
    options: {
      interface: 'lan',
      start: '100',
      limit: '150',
      leasetime: '12h',
    },
  },
  {
    type: 'host',
    options: {
      ip: '192.168.1.10',
    },
    lists: {
      mac: ['AA:BB:CC:DD:EE:FF'],
    },
  },
];
```

**Types:**

- `UciDhcpDnsmasq` - Dnsmasq DNS/DHCP server settings
- `UciDhcpDhcp` - DHCP pool settings (interface, start, limit, lease time)
- `UciDhcpOdhcp` - odhcpd (IPv6 DHCP) settings
- `UciDhcpHost` - Static host reservations (MAC-to-IP)
- `UciDhcpMatch` - DHCP match rules
- `UciDhcpBoot` - DHCP boot/PXE settings

### Firewall

#### `@sysopkit/openwrt/uci/firewall`

Firewall zones, rules, and forwarding (`/etc/config/firewall`).

```typescript
import type { UciFirewall, UciFirewallZone, UciFirewallForwarding } from '@sysopkit/openwrt/uci/firewall';

const config: UciFirewall = [
  {
    type: 'zone',
    name: 'lan',
    options: {
      input: 'ACCEPT',
      output: 'ACCEPT',
      forward: 'REJECT',
    },
    lists: {
      network: ['lan'],
    },
  },
  {
    type: 'zone',
    name: 'wan',
    options: {
      input: 'REJECT',
      output: 'ACCEPT',
      forward: 'REJECT',
      masq: '1',
      mtu_fix: '1',
    },
    lists: {
      network: ['wan'],
    },
  },
  {
    type: 'forwarding',
    name: 'lan_wan',
    options: {
      src: 'lan',
      dest: 'wan',
    },
  },
];
```

**Types:**

- `UciFirewallDefault` - Default firewall policy (input/output/forward, SYN flood)
- `UciFirewallZone` - Firewall zone definition
- `UciFirewallRule` - Firewall rules (source/dest, ports, protocol, target)
- `UciFirewallForwarding` - Zone-to-zone forwarding

### Wireless

#### `@sysopkit/openwrt/uci/wireless`

WiFi device and interface configuration (`/etc/config/wireless`).

```typescript
import type { UciWireless, UciWifiDevice, UciWifiIface } from '@sysopkit/openwrt/uci/wireless';

const config: UciWireless = [
  {
    type: 'wifi-device',
    name: 'radio0',
    options: {
      type: 'mac80211',
      channel: '36',
      band: '5g',
      htmode: 'VHT80',
      country: 'US',
    },
  },
  {
    type: 'wifi-iface',
    name: 'wifinet0',
    options: {
      device: 'radio0',
      mode: 'ap',
      ssid: 'MyNetwork',
      encryption: 'sae',
      key: 'password',
      network: 'lan',
    },
  },
];
```

**Types:**

- `UciWifiDevice` - Physical radio settings (type, channel, band, HT mode, country, tx power)
- `UciWifiIface` - WiFi interface/VAP settings (mode, SSID, encryption, hidden, client isolation, WPS, WMM, MFP)

### Dropbear (SSH)

#### `@sysopkit/openwrt/uci/dropbear`

Dropbear SSH server configuration (`/etc/config/dropbear`).

```typescript
import type { UciDropbear, UciDropbearDropbear } from '@sysopkit/openwrt/uci/dropbear';

const config: UciDropbear = [
  {
    type: 'dropbear',
    name: 'lan',
    options: {
      PasswordAuth: 'on',
      RootLogin: 'prohibit-password',
      Port: '22',
      GatewayPorts: 'off',
    },
  },
];
```

**Types:**

- `UciDropbearDropbear` - SSH server settings (password auth, root login, ports, TCP forwarding, keepalive, host keys)

### System

#### `@sysopkit/openwrt/uci/system`

System hostname, timezone, NTP, and LED configuration (`/etc/config/system`).

```typescript
import type { UciSystem, UciSystemSystem, UciSystemLed } from '@sysopkit/openwrt/uci/system';

const config: UciSystem = [
  {
    type: 'system',
    name: 'system',
    options: {
      hostname: 'router',
      timezone: 'UTC',
      description: 'OpenWRT Router',
    },
  },
  {
    type: 'led',
    name: 'wan',
    options: {
      sysfs: 'green:wan',
      trigger: 'netdev',
      dev: 'eth0',
      mode: 'link',
    },
  },
];
```

**Types:**

- `UciSystemSystem` - Core system settings (hostname, timezone, logging, root password)
- `UciSystemTimeserver` - NTP client settings
- `UciSystemLed` - LED configuration (trigger, default state, timing)
- `UciSystemRDNSSD` - Recursive DNS Server Discovery

### SQM (QoS)

#### `@sysopkit/openwrt/uci/sqm`

Smart Queue Management / QoS configuration (`/etc/config/sqm`).

```typescript
import type { UciSqm, UciSqmQueue } from '@sysopkit/openwrt/uci/sqm';

const config: UciSqm = [
  {
    type: 'queue',
    name: 'wan',
    options: {
      enabled: '1',
      interface: 'eth0',
      download: '50000',
      upload: '10000',
      qdisc: 'cake',
      script: 'piece_of_cake.qos',
      linklayer: 'ethernet',
      overhead: '34',
    },
  },
];
```

**Types:**

- `UciSqmQueue` - SQM queue config (enable, interface, rates, qdisc, script, link layer, ECN, overhead)

### UPnP

#### `@sysopkit/openwrt/uci/upnpd`

UPnP/IGD/NAT-PMP daemon configuration (`/etc/config/upnpd`).

```typescript
import type { UciUpnpd, UciUpnpdConfig, UciUpnpdPermRule } from '@sysopkit/openwrt/uci/upnpd';

const config: UciUpnpd = [
  {
    type: 'upnpd',
    name: 'config',
    options: {
      enabled: '1',
      enable_upnp: '1',
      enable_natpmp: '1',
      secure_mode: '1',
      external_iface: 'eth0',
    },
  },
  {
    type: 'perm_rule',
    name: 'default',
    options: {
      action: 'allow',
      ext_ports: '1024-65535',
      int_addr: '192.168.1.0/24',
      int_ports: '1024-65535',
    },
  },
];
```

**Types:**

- `UciUpnpdConfig` - UPnP/IGD/NAT-PMP daemon settings (enable, secure mode, bandwidth, STUN)
- `UciUpnpdPermRule` - UPnP permission rules (allow/deny, port ranges, addresses)

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))
