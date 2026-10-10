# Networks: `@sysopkit/libvirt/network`

```typescript
import {
  defineNetwork,
  undefineNetwork,
  startNetwork,
  destroyNetwork,
  setNetworkAutostart,
  updateNetwork,
  getNetwork,
  getNetworkInfo,
  listNetworks,
} from '@sysopkit/libvirt/network';
```

## NetworkConf (normalized model)

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

`nat` writes `<forward mode="nat"/>`, `bridge` writes `<forward mode="bridge"/>`, `isolated` omits `<forward>`. `route`/`open` forward modes parse as `isolated` — manage those via the raw XML path (`{ name, xml, update? }`).

## Lifecycle and inspection

- `startNetwork` → `boolean`; `destroyNetwork` (active only); `undefineNetwork` (inactive only, no-op when absent); `setNetworkAutostart`.
- `listNetworks()` (`net-list --all`: name/active/autostart/persistent), `getNetwork()` (normalized conf), `getNetworkInfo()` (`net-info`: + bridge).

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

Always acts (add-existing/delete-missing throws — converge first via `dumpxml`). Sections: `bridge`, `domain`, `ip`, `ip-dhcp-host`, `ip-dhcp-range`, `forward`, `forward-interface`, `forward-pf`, `portgroup`, `dns-host`, `dns-txt`, `dns-srv`; commands `add-first`/`add-last`/`add`/`delete`/`modify` (`modify` invalid for `ip-dhcp-range`, `forward-interface`). No flags = current state; `current` exclusive with `live`/`config`; `parentIndex?` disambiguates multiple parents.

## Isolated test networks (host-setup recipe)

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
