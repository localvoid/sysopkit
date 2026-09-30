# Networks: `@sysopkit/libvirt/network`

```typescript
import {
  defineNetwork,
  undefineNetwork,
  startNetwork,
  destroyNetwork,
  setNetworkAutostart,
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

`serializeNetworkXml`, `parseNetworkXml`, `networkConfigMatches`, `parseNetworkList`, `parseNetworkInfo`.
