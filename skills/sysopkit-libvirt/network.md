# Networks

```typescript
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

## NetworkConf

```typescript
await defineNetwork({
  network: {
    name: 'default', mode?: 'nat', // 'nat' | 'isolated' | 'bridge', default nat
    bridge?: 'virbr0', // omitted → libvirt auto-assigns virbrN (wildcard in compare)
    ip?: '192.168.122.1', // required for nat
    netmask?: '255.255.255.0',
    dhcpRanges?: [{ start, end }],
  },
});
```

Mode mapping:

- `nat` writes `<forward mode="nat"/>`.
- `bridge` writes `<forward mode="bridge"/>`.
- `isolated` omits `<forward>`.
- `route` and `open` forward modes parse as `isolated`; manage them through the raw XML path (`{ name, xml, update? }`).

## Lifecycle and inspection

- `startNetwork` → `boolean`; `destroyNetwork` (active only); `undefineNetwork` (inactive only, no-op when absent); `setNetworkAutostart`.
- `listNetworks()` (`net-list --all`: name/active/autostart/persistent), `getNetwork()` (normalized conf), `getNetworkInfo()` (`net-info`, plus bridge).

## Live section updates (`net-update`)

```typescript
await updateNetwork({
  name: 'default',
  command: 'add',
  section: 'ip-dhcp-host',
  xml: `<host mac='...' name='bob' ip='192.168.122.45'/>`,
  live: true,
  config: true,
});
```

`updateNetwork` always acts. Adding an existing entry or deleting a missing one throws, so converge first by reading `dumpxml`.

- Sections: `bridge`, `domain`, `ip`, `ip-dhcp-host`, `ip-dhcp-range`, `forward`, `forward-interface`, `forward-pf`, `portgroup`, `dns-host`, `dns-txt`, `dns-srv`.
- Commands: `add-first`, `add-last`, `add`, `delete`, `modify`. `modify` is invalid for `ip-dhcp-range` and `forward-interface`.
- No flags targets current state; `current` is exclusive with `live`/`config`. `parentIndex?` disambiguates multiple parents.

## Isolated test network

```typescript
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

## Pure helpers

`serializeNetworkXml`, `parseNetworkXml`, `parseNetworkDhcpHosts`, `networkConfigMatches`, `parseNetworkList`, `parseNetworkInfo`.
