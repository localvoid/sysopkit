# Storage: `@sysopkit/libvirt/storage`

```typescript
import {
  definePool,
  undefinePool,
  buildPool,
  startPool,
  destroyPool,
  setPoolAutostart,
  getPool,
  getPoolInfo,
  listPools,
  createVolume,
  deleteVolume,
  getVolumeInfo,
  listVolumes,
  volumeExists,
} from '@sysopkit/libvirt/storage';
```

## Pools (`dir` only)

```typescript
await definePool({ pool: { name: 'default', path: '/var/lib/libvirt/images' } });
await buildPool({ name: 'default' }); // mkdirs target, no-op when built (reads path from pool XML)
await startPool({ name: 'default' }); // boolean
await setPoolAutostart({ name: 'default', autostart: true });
```

Non-`dir` pools throw in `parsePoolXml` — use the raw XML path (`{ name, xml, update? }`). `listPools()` (`pool-list --all`), `getPool()` (normalized conf), `getPoolInfo()` (`pool-info`: active/autostart/persistent).

## Volumes

```typescript
await createVolume({
  pool: 'default',
  volume: { name: 'guest.qcow2', capacityMiB: 20480, format?: 'qcow2', backingPath?, backingFormat? },
});
await deleteVolume({ pool: 'default', name: 'old.qcow2' }); // no-op when absent
```

`createVolume` (`vol-create` with serialized XML) is a no-op when a volume with the same name, capacity, and format exists, and **throws** when it differs (volumes can't be resized in place — delete first). `getVolumeInfo` (`vol-dumpxml`: name/capacityMiB/format/path, units converted), `listVolumes({ pool })` (names via `vol-list`), `volumeExists`.

## Pure helpers

`serializePoolXml`, `parsePoolXml`, `poolConfigMatches`, `serializeVolumeXml`, `parseVolumeInfo`, `parsePoolList`, `parsePoolInfo`, `parseVolumeList`.
