---
name: sysopkit-libvirt
description: Libvirt virtualization with sysopkit. Use when defining or managing KVM domains, virtual networks, storage pools/volumes, snapshots, or cdrom media — normalized DomainConf/NetworkConf/PoolConf/VolumeConf types, virsh define/lifecycle ops. Requires the sysopkit skill for execution model, connectors, and apply().
---

# SysopKit Libvirt

Normalized libvirt management (`@sysopkit/libvirt/*`). Typed configs instead of hand-written XML; `virsh` remains the transport. **Bun-only** — parsing/serialization delegate to `Bun.XML`.

```typescript
import { defineDomain, startDomain } from '@sysopkit/libvirt/domain';

await defineDomain({ domain: { name: 'guest', memoryMiB: 2048, vcpus: 2 } });
await startDomain({ name: 'guest' });
```

Idempotency model for all `define*`: parse live `dumpxml`, field-compare with `*ConfigMatches`, redefine only on drift. Fields left undefined are **wildcards** (generated MACs, UUIDs, emulator paths, auto-added video/memballoon never cause drift). Raw-XML escape hatch (`{ name, xml, update? }`) defines by existence, redefines only with `update: true`.

Rules that always apply:

- Every op accepts `{ uri?: 'qemu:///system' }`; omitted means the virsh default connection.
- All invocations run under `LC_ALL=C` (virsh output is gettext-translated; parsers expect English).
- Never pipe XML through `define /dev/stdin` — stdin fds can't be reopened by path on every transport (ENXIO, then EPIPE). The package stages through temp files internally; use `withTempFile` (`sysopkit/op/temp`) for your own file-needing commands.
- State changes go through `domstate` (single token); autostart through `dominfo`/`net-info`/`pool-info`; config through `dumpxml`.

## Router — read the page that matches the task

| Task | Read |
| --- | --- |
| Domains: `DomainConf`, define/lifecycle/autostart, snapshots, cdrom media, `domifaddr`, inactive XML | [domain.md](domain.md) |
| Networks: `NetworkConf` (`nat`/`isolated`/`bridge`), define/lifecycle/autostart | [network.md](network.md) |
| Pools (`dir`) and volumes: define/build/start, create/delete | [storage.md](storage.md) |

## Pitfalls

- Minimal configs converge only on specified fields — a `{ name, memoryMiB, vcpus }` define never touches firmware, disks, or networks already present. Specify what you own.
- `defineDomain` array entries (disks/networks) compare **positionally**; reordered entries read as drift.
- `revertSnapshot` is destructive and always acts (like `restartService`) — gate it yourself.
- `createVolume` throws when the existing volume differs in capacity/format (volumes can't be resized in place) — delete first.
- Disk/interface/pool types outside the model (`rbd`, `floppy`, non-`dir` pools, `route` forwarding) throw with a raw-XML-path pointer instead of silently degrading.
