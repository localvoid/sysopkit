# UCI config reference

```typescript
import type { UciNetwork } from '@sysopkit/openwrt/uci/network';
import type { UciWireless } from '@sysopkit/openwrt/uci/wireless';
import type { UciFirewall } from '@sysopkit/openwrt/uci/firewall';
import type { UciSystem } from '@sysopkit/openwrt/uci/system';
import type { UciDhcp } from '@sysopkit/openwrt/uci/dhcp';
import type { UciDropbear } from '@sysopkit/openwrt/uci/dropbear';
import type { UciSqm } from '@sysopkit/openwrt/uci/sqm';
import type { UciUpnpd } from '@sysopkit/openwrt/uci/upnpd';
```

All submodules above are **types-only** — pair each with `serializeUci` (see [uci](uci.md)). Each entry
shows the top-level config type (`/etc/config/<name>`) and its section union.

## network (`@sysopkit/openwrt/uci/network`)

- `UciNetwork = UciNetworkSection[]` (`/etc/config/network`).
- Sections: `UciNetworkInterface` (proto, device, ipaddr, gateway, dns…),
  `UciNetworkDevice` (device-level options), `UciNetworkGlobals`,
  `UciNetworkRoute`, `UciNetworkRule`, `UciNetworkBridgeVlan`.

## wireless (`@sysopkit/openwrt/uci/wireless`)

- `UciWireless = UciWirelessSection[]` (`/etc/config/wireless`).
- Sections: `UciWifiDevice` (radio: type, channel, band, txpower…),
  `UciWifiIface` (ssid, encryption, key, network attachment…).

## firewall (`@sysopkit/openwrt/uci/firewall`)

- `UciFirewall = UciFirewallSection[]` (`/etc/config/firewall`).
- Sections: `UciFirewallDefault`, `UciFirewallZone`, `UciFirewallRule`,
  `UciFirewallForwarding`.

## system (`@sysopkit/openwrt/uci/system`)

- `UciSystem = UciSystemSection[]` (`/etc/config/system`).
- Sections: `UciSystemSystem` (hostname, timezone…), `UciSystemTimeserver`,
  `UciSystemLed`, `UciSystemRDNSSD`.

## dhcp (`@sysopkit/openwrt/uci/dhcp`)

- `UciDhcp = UciDhcpSection[]` (`/etc/config/dhcp`).
- Sections: `UciDhcpDnsmasq`, `UciDhcpDhcp`, `UciDhcpOdhcp`, `UciDhcpHost`
  (static leases), `UciDhcpMatch`, `UciDhcpBoot`.

## dropbear (`@sysopkit/openwrt/uci/dropbear`)

- `UciDropbear = UciDropbearSection[]` (`/etc/config/dropbear`; `UciDropbearSection`
  is an alias of the top-level config).
- Section: `UciDropbearDropbear` (port, password auth, root login…).

## sqm (`@sysopkit/openwrt/uci/sqm`)

- `UciSqm = UciSqmQueue[]` (`/etc/config/sqm`).
- Section: `UciSqmQueue` (interface, qdisc, shaper rates…).

## upnpd (`@sysopkit/openwrt/uci/upnpd`)

- `UciUpnpd = UciUpnpdSection[]` (`/etc/config/upnpd`).
- Sections: `UciUpnpdConfig`, `UciUpnpdPermRule`.

## Pitfalls

- Section `type` strings must match the device's expected UCI types exactly —
  a typo produces a config the daemon ignores without error.
- Reload/restart per subsystem after change: `network` → `/etc/init.d/network reload`,
  `wireless` → `wifi reload`, `firewall` → `/etc/init.d/firewall reload`,
  `dhcp`/`system` → restart the respective service. A file write without the
  matching reload changes nothing at runtime — confirm the exact command on the
  target OpenWrt version.
