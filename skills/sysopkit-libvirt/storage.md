# Storage

```typescript
import {
  buildPool,
  createVolume,
  definePool,
  deleteVolume,
  destroyPool,
  getPool,
  getPoolInfo,
  getVolumeInfo,
  listPools,
  listVolumes,
  setPoolAutostart,
  startPool,
  undefinePool,
} from '@sysopkit/libvirt/storage';
```

## Pools (`dir` only)

```typescript
await definePool({ pool: { name: 'default', path: '/var/lib/libvirt/images' } });
await buildPool({ name: 'default' }); // mkdirs target, no-op when built (reads path from pool XML)
await startPool({ name: 'default' }); // boolean
await setPoolAutostart({ name: 'default', autostart: true });
```

Non-`dir` pools throw in `parsePoolXml`; use the raw XML path (`{ name, xml, update? }`). `listPools()` (`pool-list --all`), `getPool()` (normalized conf), `getPoolInfo()` (`pool-info`: active/autostart/persistent).

## Volumes

```typescript
await createVolume({
  pool: 'default',
  volume: { name: 'guest.qcow2', capacityMiB: 20480, format?: 'qcow2', backingPath?, backingFormat? },
});
await deleteVolume({ pool: 'default', name: 'old.qcow2' }); // no-op when absent
```

`createVolume` (`vol-create` with serialized XML) is a no-op when a volume with the same name, capacity, and format exists. It **throws** when they differ, because volumes cannot be resized in place — delete first.

`getVolumeInfo` (`vol-dumpxml`: name/capacityMiB/format/path, units converted), `listVolumes({ pool })` (names via `vol-list`), `volumeExists`.

## Pure helpers

`serializePoolXml`, `parsePoolXml`, `poolConfigMatches`, `serializeVolumeXml`, `parseVolumeInfo`, `parsePoolList`, `parsePoolInfo`, `parseVolumeList`.
