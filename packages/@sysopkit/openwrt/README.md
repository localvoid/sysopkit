# @sysopkit/openwrt

Type-safe UCI (Unified Configuration Interface) types and serialization for OpenWrt, used with [SysopKit](https://www.sysopkit.com). Peer dependencies: `sysopkit`, `@sysopkit/linux`.

## Installation

```sh
bun add @sysopkit/openwrt sysopkit @sysopkit/linux
# pnpm add @sysopkit/openwrt sysopkit @sysopkit/linux
# npm install @sysopkit/openwrt sysopkit @sysopkit/linux
```

## Usage

```typescript
import { serializeUci } from '@sysopkit/openwrt/uci';
import type { UciNetwork } from '@sysopkit/openwrt/uci/network';

const config: UciNetwork = [
  {
    type: 'interface',
    name: 'lan',
    options: { device: 'br-lan', proto: 'static', ipaddr: '192.168.1.1', netmask: '255.255.255.0' },
  },
  {
    type: 'device',
    name: 'br-lan',
    options: { type: 'bridge' },
    lists: { ports: ['lan1', 'lan2'] },
  },
];

const text = serializeUci(config);
// config interface 'lan'
//     option device 'br-lan'
//     ...
```

Write `text` to the target with `createFile`, then reload with `sh('service network reload')` or `sh('ubus call system reload')`, depending on the subsystem.

## Modules

| Import | `/etc/config/*` | Key types |
| --- | --- | --- |
| `@sysopkit/openwrt/uci` | — | `serializeUci(config)`, `UciConfig`, `UciSection` |
| `@sysopkit/openwrt/uci/network` | `network` | `UciNetworkInterface`, `UciNetworkDevice`, `UciNetworkGlobals`, `UciNetworkRoute`, `UciNetworkRule`, `UciNetworkBridgeVlan` |
| `@sysopkit/openwrt/uci/dhcp` | `dhcp` | `UciDhcpDnsmasq`, `UciDhcpDhcp`, `UciDhcpOdhcp`, `UciDhcpHost`, `UciDhcpMatch`, `UciDhcpBoot` |
| `@sysopkit/openwrt/uci/firewall` | `firewall` | `UciFirewallDefault`, `UciFirewallZone`, `UciFirewallRule`, `UciFirewallForwarding` |
| `@sysopkit/openwrt/uci/wireless` | `wireless` | `UciWifiDevice`, `UciWifiIface` |
| `@sysopkit/openwrt/uci/dropbear` | `dropbear` | `UciDropbearDropbear` |
| `@sysopkit/openwrt/uci/system` | `system` | `UciSystemSystem`, `UciSystemTimeserver`, `UciSystemLed`, `UciSystemRDNSSD` |
| `@sysopkit/openwrt/uci/sqm` | `sqm` | `UciSqmQueue` |
| `@sysopkit/openwrt/uci/upnpd` | `upnpd` | `UciUpnpdConfig`, `UciUpnpdPermRule` |
| `@sysopkit/openwrt/pkg/apk` | — | **Idempotent** `installPackages`, `removePackages` (dry-run via `--simulate`); `getInstalledPackages()` |

See the [docs site](https://www.sysopkit.com) for field-level details.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](../../../LICENSE-APACHE))
- MIT license ([LICENSE-MIT](../../../LICENSE-MIT))
