---
title: Storage
description: Libvirt storage pool and volume management with a normalized TypeScript API.
---

Manage storage pools with `PoolConf` and volumes with `VolumeConf` instead of hand-written XML. `virsh` remains the transport; XML parsing and serialization use `Bun.XML`, so `@sysopkit/libvirt` only runs on the Bun runtime.

```ts
import {
  buildPool,
  createVolume,
  definePool,
  deleteVolume,
  destroyPool,
  getPool,
  getVolumeInfo,
  listPools,
  listVolumes,
  setPoolAutostart,
  startPool,
  undefinePool,
} from '@sysopkit/libvirt/storage';
```

## Pools

> **IDEMPOTENT**

Only `dir` pools are modeled. Defining compares `virsh pool-dumpxml` output field-by-field and redefines only on drift; other pool types use the raw XML path (`definePool({ name, xml, update })`).

```ts
await definePool({ pool: { name: 'default', path: '/var/lib/libvirt/images' } });
await buildPool({ name: 'default' }); // creates the target dir, no-op when built
await startPool({ name: 'default' }); // true when it was started
await setPoolAutostart({ name: 'default', autostart: true });
await destroyPool({ name: 'default' }); // no-op when inactive
await undefinePool({ name: 'default' }); // no-op when not defined
```

```ts
const pools = await listPools();
// [{ name: 'default', active: true, autostart: true }, ...]

const conf = await getPool({ name: 'default' }); // normalized PoolConf
const info = await getPoolInfo({ name: 'default' });
// { name, active, autostart, persistent }
```

## Volumes

> **IDEMPOTENT**

```ts
await createVolume({
  pool: 'default',
  volume: { name: 'guest.qcow2', capacityMiB: 20480 },
});

await createVolume({
  pool: 'default',
  volume: {
    name: 'overlay.qcow2',
    capacityMiB: 10240,
    backingPath: '/var/lib/libvirt/images/base.qcow2',
  },
});

await deleteVolume({ pool: 'default', name: 'overlay.qcow2' }); // no-op when absent
```

`createVolume()` is a no-op when a volume with the same name, capacity, and format already exists, and throws when the existing volume differs (volumes cannot be resized in place through this API — delete first).

```ts
const volumes = await listVolumes({ pool: 'default' }); // ['guest.qcow2', ...]
const vol = await getVolumeInfo({ pool: 'default', name: 'guest.qcow2' });
// { name, capacityMiB, format, path }
```

All operations accept an optional connection URI (`{ uri: 'qemu:///system' }`). When omitted, the virsh default connection is used.

## Configuration types

```ts
import type { PoolConf, PoolInfo, VolumeConf, VolumeInfo } from '@sysopkit/libvirt/storage';
import { poolConfigMatches, serializePoolXml, serializeVolumeXml } from '@sysopkit/libvirt/storage';
import { parsePoolXml, parseVolumeInfo } from '@sysopkit/libvirt/storage';
```

- `serializePoolXml(conf)` / `parsePoolXml(xml)` — build and read pool XML.
- `serializeVolumeXml(volume)` — build volume XML for `virsh vol-create`; `parseVolumeInfo(xml)` reads `virsh vol-dumpxml` output.
- `poolConfigMatches(current, desired)` — the drift check used by `definePool()`.
- `parsePoolList(output)` / `parsePoolInfo(output)` / `parseVolumeList(output)` — parse `virsh pool-list` / `pool-info` / `vol-list` output.
