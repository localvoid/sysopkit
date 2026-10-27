---
name: sysopkit-libvirt
description: 'Libvirt/KVM in SysopKit: normalized DomainConf/NetworkConf/PoolConf/VolumeConf, drift-only redefines, virsh lifecycle ops, snapshots, cdrom media, net-update, storage volumes. Bun-only.'
---

# SysopKit Libvirt

Normalized libvirt management (`@sysopkit/libvirt/*`). Typed configs replace hand-written XML; `virsh` stays the transport. **Bun-only**: parsing and serialization use `Bun.XML`.

```typescript
import { defineDomain, startDomain } from '@sysopkit/libvirt/domain';

await defineDomain({ domain: { name: 'guest', memoryMiB: 2048, vcpus: 2 } });
await startDomain({ name: 'guest' });
```

## Drift

Every `define*` parses the live `dumpxml`, compares it with `*ConfigMatches`, and redefines only on **drift**. A second `define` with the same config is a no-op. Fields left undefined are **wildcards**: generated MACs, UUIDs, emulator paths, and auto-added video/memballoon never cause drift.

The raw-XML escape hatch (`{ name, xml, update? }`) defines by existence and redefines only with `update: true`. Use it for anything the normalized model does not cover.

Four rules apply to every op:

- Every op accepts `{ uri?: 'qemu:///system' }`; omitting it uses the virsh default connection.
- All invocations run under `LC_ALL=C` because virsh output is gettext-translated and the parsers expect English.
- Stage XML through real files, never `define /dev/stdin`: stdin fds cannot be reopened by path on every transport (ENXIO, then EPIPE). The package does this internally; use `withTempFile` (`sysopkit/op/temp`) for your own file-needing commands.
- Read state from `domstate` (single token), autostart from `dominfo`/`net-info`/`pool-info`, and config from `dumpxml`.

## Route by resource

| Task | Read |
| --- | --- |
| Domains: `DomainConf`, define/lifecycle/autostart, snapshots, cdrom media, `domifaddr`, inactive XML | [domain.md](domain.md) |
| Networks: `NetworkConf` (`nat`/`isolated`/`bridge`), define/lifecycle/autostart, `net-update` section edits | [network.md](network.md) |
| Pools (`dir`) and volumes: define/build/start, create/delete | [storage.md](storage.md) |

## Rules

- A minimal config converges only on the fields it specifies. `{ name, memoryMiB, vcpus }` never touches firmware, disks, or networks already present; specify what you own.
- `defineDomain` compares disk and network entries **positionally**; reordering them reads as drift.
- `revertSnapshot` is destructive and always acts (like `restartService`); gate it yourself.
- `createVolume` throws when the existing volume differs in capacity or format. Volumes cannot be resized in place; delete first.
- Types outside the model (`rbd`, `floppy`, non-`dir` pools) throw with a raw-XML-path pointer instead of degrading silently. `route`/`open` forwarding parses as `isolated`; use raw XML when you need it preserved.
