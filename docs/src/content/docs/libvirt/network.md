---
title: Networks
description: Libvirt virtual network management with a normalized TypeScript API.
---

Manage virtual networks with `NetworkConf` instead of hand-written XML. `virsh` remains the transport; XML parsing and serialization use `Bun.XML`, so `@sysopkit/libvirt` only runs on the Bun runtime.

```ts
import {
  defineNetwork,
  destroyNetwork,
  getNetwork,
  getNetworkInfo,
  listNetworks,
  setNetworkAutostart,
  startNetwork,
  undefineNetwork,
  updateNetwork,
} from '@sysopkit/libvirt/network';
```

## defineNetwork()

> **IDEMPOTENT**

Defines a network from a normalized config (`nat`/`isolated`/`bridge`, gateway address, DHCP ranges). Compares `virsh net-dumpxml` output field-by-field and redefines only on drift; fields left undefined act as wildcards (e.g. an omitted bridge name never fights libvirt's auto-assigned `virbrN`).

```ts
await defineNetwork({
  network: {
    name: 'default',
    mode: 'nat',
    ip: '192.168.122.1',
    netmask: '255.255.255.0',
    dhcpRanges: [{ start: '192.168.122.2', end: '192.168.122.254' }],
  },
});

await defineNetwork({ network: { name: 'isolated', mode: 'isolated' } });
await defineNetwork({ network: { name: 'br', mode: 'bridge', bridge: 'br0' } });
```

Networks with options outside the model (static DHCP host entries, DNS forwarders, portgroups, `route`/`open` forwarding, ...) use the raw XML path, which defines by existence and only redefines with `update: true`:

```ts
await defineNetwork({ name: 'special', xml, update: true });
```

## updateNetwork()

> Always acts (no idempotency check — adding an existing entry or deleting a missing one throws).

Updates one section of an existing network without restarting it (`virsh net-update`). All sections are supported: `bridge`, `domain`, `ip`, `ip-dhcp-host`, `ip-dhcp-range`, `forward`, `forward-interface`, `forward-pf`, `portgroup`, `dns-host`, `dns-txt`, `dns-srv`. Directives: `add-first`, `add-last` (`add` is a synonym), `delete`, `modify` (`modify` is rejected by libvirt for `ip-dhcp-range` and `forward-interface`).

```ts
await updateNetwork({
  name: 'default',
  command: 'add',
  section: 'ip-dhcp-host',
  xml: `<host mac='52:54:00:00:00:01' name='bob' ip='192.168.122.45'/>`,
  live: true,
  config: true,
});
```

Omitting `live`/`config`/`current` targets the current network state (the virsh default). `current: true` is exclusive with `live`/`config`, and `parentIndex` selects the parent element when several exist (e.g. multiple `<ip>` elements). The network must exist; `live` requires it to be active.

## Lifecycle

```ts
await startNetwork({ name: 'default' }); // true when it was started
await destroyNetwork({ name: 'default' }); // no-op when inactive
await undefineNetwork({ name: 'default' }); // no-op when not defined
await setNetworkAutostart({ name: 'default', autostart: true });
```

## Isolated test networks

Host setups that need guest-to-guest (or guest-to-host) traffic without NAT or a physical bridge can compose `defineNetwork()` + `startNetwork()` with `mode: 'isolated'`:

```ts
await defineNetwork({
  network: {
    name: 'test-isolated',
    mode: 'isolated',
    ip: '192.168.150.1',
    netmask: '255.255.255.0',
    dhcpRanges: [{ start: '192.168.150.2', end: '192.168.150.254' }],
  },
});
await startNetwork({ name: 'test-isolated' });
```

## Inspection

```ts
const networks = await listNetworks();
// [{ name: 'default', active: true, autostart: true, persistent: true }, ...]

const conf = await getNetwork({ name: 'default' }); // normalized NetworkConf
const info = await getNetworkInfo({ name: 'default' });
// { name, active, autostart, persistent, bridge }
```

All operations accept an optional connection URI (`{ uri: 'qemu:///system' }`). When omitted, the virsh default connection is used.

## Configuration types

```ts
import type { NetworkConf, NetworkDhcpRange, NetworkInfo } from '@sysopkit/libvirt/network';
import {
  networkConfigMatches,
  parseNetworkXml,
  serializeNetworkXml,
} from '@sysopkit/libvirt/network';
```

- `serializeNetworkXml(conf)` / `parseNetworkXml(xml)` — build and read network XML; `parseNetworkXml` keeps only the modeled subset.
- `networkConfigMatches(current, desired)` — the drift check used by `defineNetwork()`.
- `parseNetworkList(output)` / `parseNetworkInfo(output)` — parse `virsh net-list` / `net-info` output.
