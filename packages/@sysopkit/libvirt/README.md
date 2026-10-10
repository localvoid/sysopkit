# @sysopkit/libvirt

Libvirt virtualization operations for [SysopKit](https://www.sysopkit.com): manage domains, networks, storage pools, and volumes with a normalized TypeScript API instead of hand-written XML. Requires `sysopkit` as a peer dependency — every function runs inside the current execution context (connector + reporter).

> **Bun-only.** XML parsing and serialization delegate to `Bun.XML.parse` / `Bun.XML.stringify`, so this package only runs on the Bun runtime.

## Installation

```sh
bun add @sysopkit/libvirt sysopkit
```

## Modules

| Module | Import | Highlights |
| --- | --- | --- |
| `domain` | `@sysopkit/libvirt/domain` | **Idempotent** `defineDomain` (`DomainConf` incl. `cdrom` devices, or raw `xml`), `undefineDomain` (`removeNvram?`, `snapshotsMetadata?`), `startDomain`, `shutdownDomain`, `destroyDomain`, `setDomainAutostart`, `createSnapshot` (`memspec?`, `diskspecs?`), `revertSnapshot`, `changeDomainMedia` (`eject`/`insert`/`update`); `listDomains`, `listSnapshots`, `snapshotExists`, `getDomain`, `getDomainXml` (`inactive?`), `getDomainInfo`, `getDomainIfAddr` |
| `network` | `@sysopkit/libvirt/network` | **Idempotent** `defineNetwork`, `undefineNetwork`, `startNetwork`, `destroyNetwork`, `setNetworkAutostart`; always-acts `updateNetwork` (`net-update`: all sections/commands, `live`/`config`/`current`, `parentIndex?`); `NetworkConf` (`nat`/`isolated`/`bridge`), `serializeNetworkXml`, `parseNetworkXml`, `parseNetworkDhcpHosts`, `listNetworks`, `getNetworkInfo` |
| `storage` | `@sysopkit/libvirt/storage` | **Idempotent** `definePool`, `undefinePool`, `buildPool`, `startPool`, `destroyPool`, `setPoolAutostart`, `createVolume`, `deleteVolume`; `PoolConf` (`dir`), `VolumeConf`, `listPools`, `listVolumes`, `getVolumeInfo` |

All virsh operations accept an optional connection URI (`{ uri: 'qemu:///system' }`). When omitted, the virsh default connection is used.

## Usage

```typescript
import { defineDomain, setDomainAutostart, startDomain } from '@sysopkit/libvirt/domain';
import { defineNetwork, startNetwork } from '@sysopkit/libvirt/network';
import { buildPool, createVolume, definePool, startPool } from '@sysopkit/libvirt/storage';

await defineNetwork({
  network: {
    name: 'default',
    mode: 'nat',
    ip: '192.168.122.1',
    netmask: '255.255.255.0',
    dhcpRanges: [{ start: '192.168.122.2', end: '192.168.122.254' }],
  },
});
await startNetwork({ name: 'default' });

await definePool({ pool: { name: 'default', path: '/var/lib/libvirt/images' } });
await buildPool({ name: 'default' });
await startPool({ name: 'default' });

await createVolume({
  pool: 'default',
  volume: { name: 'guest.qcow2', capacityMiB: 20480 },
});

await defineDomain({
  domain: {
    name: 'guest',
    memoryMiB: 2048,
    vcpus: 2,
    firmware: {
      loader: '/usr/share/edk2/ovmf/OVMF_CODE.fd',
      template: '/usr/share/edk2/ovmf/OVMF_VARS.fd',
    },
    disks: [{ source: '/var/lib/libvirt/images/guest.qcow2' }],
    networks: [{ source: 'default' }],
    agent: true,
  },
});
await setDomainAutostart({ name: 'guest', autostart: true });
await startDomain({ name: 'guest' });
```

Idempotency compares `virsh dumpxml` output field-by-field; fields left undefined in the desired config act as wildcards, so libvirt-assigned values (generated MACs, emulator paths, auto-added video/memballoon devices) never cause drift. A replacement define over an existing name requires the same explicit `<uuid>` — pass the `uuid` from `getDomain()` when redefining, otherwise libvirt rejects it. Devices outside the normalized model (PCI passthrough, TPM, NUMA, ...) are managed through the raw XML path (`defineDomain({ name, xml, update })`).

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](../../../LICENSE-APACHE))
- MIT license ([LICENSE-MIT](../../../LICENSE-MIT))
