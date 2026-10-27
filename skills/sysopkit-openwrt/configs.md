# UCI config reference

Each package under `@sysopkit/openwrt/uci/*` is types-only. Pair the type with `serializeUci` from `@sysopkit/openwrt/uci`; see [uci](uci.md) for the model.

## network

`@sysopkit/openwrt/uci/network` — `/etc/config/network`

- `UciNetwork = UciNetworkSection[]`.
- Sections: `UciNetworkInterface` (proto, device, ipaddr, gateway, dns…), `UciNetworkDevice` (device-level options), `UciNetworkGlobals`, `UciNetworkRoute`, `UciNetworkRule`, `UciNetworkBridgeVlan`.
- Reload: `/etc/init.d/network reload`.

## wireless

`@sysopkit/openwrt/uci/wireless` — `/etc/config/wireless`

- `UciWireless = UciWirelessSection[]`.
- Sections: `UciWifiDevice` (radio: type, channel, band, txpower…), `UciWifiIface` (ssid, encryption, key, network attachment…).
- Reload: `wifi reload`.

## firewall

`@sysopkit/openwrt/uci/firewall` — `/etc/config/firewall`

- `UciFirewall = UciFirewallSection[]`.
- Sections: `UciFirewallDefault`, `UciFirewallZone`, `UciFirewallForwarding`. `UciFirewallRule` is exported but is not part of the `UciFirewallSection` union in the current source; widen the type if you need rule sections.
- Reload: `/etc/init.d/firewall reload`.

## system

`@sysopkit/openwrt/uci/system` — `/etc/config/system`

- `UciSystem = UciSystemSection[]`.
- Sections: `UciSystemSystem` (hostname, timezone…), `UciSystemTimeserver`, `UciSystemLed`, `UciSystemRDNSSD`.
- Reload: `/etc/init.d/system reload`.

## dhcp

`@sysopkit/openwrt/uci/dhcp` — `/etc/config/dhcp`

- `UciDhcp = UciDhcpSection[]`.
- Sections: `UciDhcpDnsmasq`, `UciDhcpDhcp`, `UciDhcpOdhcp`, `UciDhcpHost` (static leases), `UciDhcpMatch`, `UciDhcpBoot`.
- Reload: `/etc/init.d/dnsmasq restart` (and `odhcpd` for DHCPv6).

## dropbear

`@sysopkit/openwrt/uci/dropbear` — `/etc/config/dropbear`

- `UciDropbear = UciDropbearSection[]`; `UciDropbearSection` aliases the top-level config.
- Section: `UciDropbearDropbear` (port, password auth, root login…).
- Reload: `/etc/init.d/dropbear restart`.

## sqm

`@sysopkit/openwrt/uci/sqm` — `/etc/config/sqm`

- `UciSqm = UciSqmQueue[]`.
- Section: `UciSqmQueue` (interface, qdisc, shaper rates…).
- Reload: `/etc/init.d/sqm restart`.

## upnpd

`@sysopkit/openwrt/uci/upnpd` — `/etc/config/upnpd`

- `UciUpnpd = UciUpnpdSection[]`.
- Sections: `UciUpnpdConfig`, `UciUpnpdPermRule`.
- Reload: `/etc/init.d/miniupnpd restart`.

## Rules

- Build the whole file. A section left out of the array is deleted from the device.
- Section `type` strings must match the device's expected UCI types exactly; a typo is silently ignored.
- Reload commands vary by OpenWrt version and installed packages. Confirm the exact command on the target.
