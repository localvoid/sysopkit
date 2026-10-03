---
title: Domains
description: Libvirt domain (virtual machine) management with a normalized TypeScript API.
---

Manage virtual machines with `DomainConf` instead of hand-written XML. `virsh` remains the transport; XML parsing and serialization use `Bun.XML`, so `@sysopkit/libvirt` only runs on the Bun runtime.

```ts
import {
  createSnapshot,
  changeDomainMedia,
  defineDomain,
  destroyDomain,
  getDomainIfAddr,
  getDomain,
  getDomainInfo,
  listDomains,
  listSnapshots,
  revertSnapshot,
  setDomainAutostart,
  shutdownDomain,
  snapshotExists,
  startDomain,
  undefineDomain,
} from '@sysopkit/libvirt/domain';
```

## defineDomain()

> **IDEMPOTENT**

Defines a domain from a normalized config. Compares `virsh dumpxml` output field-by-field and redefines only on drift; fields left undefined act as wildcards, so libvirt-assigned values (generated MACs, emulator paths, auto-added video/memballoon devices) never cause drift. A replacement define over an existing name requires the same explicit `<uuid>` — include the `uuid` from `getDomain()` when redefining, otherwise libvirt rejects it.

```ts
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
```

The normalized model covers type/arch/machine, UUID (round-tripped for redefine), UEFI (explicit loader paths plus `<loader secure='yes'|'no'>` via `firmware.secure`; `undefined` omits the attribute), direct kernel boot (`kernel`/`initrd`/`cmdline` for `<os>` direct boot, e.g. Live ISOs with an extracted kernel for `virsh console` serial access), CPU mode, boot order, virtio/scsi/sata/ide disks (`disk` and `cdrom` devices — the latter for persistent seed images), network/bridge interfaces, 9p host-directory shares (`filesystems: [{ source, target, readonly? }]` → `<filesystem type='mount' accessmode='passthrough'>`, guest mounts `mount -t 9p <target> <path>`), spice/vnc graphics, serial consoles, and the qemu-guest-agent channel. Disk targets default to `vdX`/`sdX` in order; unset interface models default to `virtio`; graphics default to spice with no network listener.

Firmware-autoselection markup (`os/@firmware='efi'`, `os/<firmware>`, e.g. from `virt-install --boot uefi`) parses via its explicit `<loader>`/`<nvram>` pair and is never serialized. Switching secure-boot variants (e.g. `OVMF_*_4M.secboot.qcow2` → `OVMF_*_4M.qcow2`, a distro-specific naming kept caller-side): `getDomain` → rewrite `firmware.loader`/`template`, set `secure: false` → `defineDomain` with the `uuid` from `getDomain`; `undefine --nvram` first is still required (VARS contents are incompatible).

```ts
await defineDomain({
  domain: {
    name: 'guest',
    memoryMiB: 2048,
    vcpus: 2,
    disks: [
      { source: '/var/lib/libvirt/images/guest.qcow2' },
      {
        device: 'cdrom',
        source: '/var/lib/libvirt/images/seed.iso',
        target: 'sda',
        bus: 'sata',
        readonly: true,
      },
    ],
    networks: [{ source: 'default' }],
  },
});
```

Domains with devices outside the model (PCI passthrough, TPM, NUMA tuning, ...) use the raw XML path, which defines by existence and only redefines with `update: true` (libvirt reformats XML on define, so raw XML cannot be compared semantically):

```ts
await defineDomain({ name: 'special', xml, update: true });
```

## Lifecycle

```ts
await startDomain({ name: 'guest' }); // true when it was started
await shutdownDomain({ name: 'guest' }); // graceful (ACPI), no-op unless running
await destroyDomain({ name: 'guest' }); // force off, no-op unless active
await undefineDomain({ name: 'guest' }); // no-op when not defined
await undefineDomain({ name: 'guest', removeNvram: true }); // also drop UEFI vars
await undefineDomain({ name: 'guest', snapshotsMetadata: true }); // also drop snapshot metadata
await setDomainAutostart({ name: 'guest', autostart: true });
```

## Snapshots

```ts
await createSnapshot({ name: 'guest', snapshot: 'clean' }); // true when created
await createSnapshot({
  name: 'guest',
  snapshot: 'pre-upgrade',
  description: 'before system upgrade',
  diskOnly: true,
  quiesce: true,
  atomic: true,
});
await createSnapshot({
  name: 'guest',
  snapshot: 'external',
  memspec: { file: '/snapshots/guest-mem.img', snapshot: 'external' },
  diskspecs: [{ disk: 'vda', snapshot: 'external', file: '/snapshots/guest-vda.qcow2' }],
});

await revertSnapshot({ name: 'guest', snapshot: 'clean' });
await revertSnapshot({ name: 'guest', force: true, resetNvram: true }); // current snapshot

const snaps = await listSnapshots({ name: 'guest' });
// [{ name: 'clean', creationTime: '2026-09-30 12:00:00 +0000', state: 'shutoff' }, ...]
const exists = await snapshotExists({ name: 'guest', snapshot: 'clean' });
```

`createSnapshot()` is idempotent by snapshot name (snapshots are immutable, so existence implies identity). `revertSnapshot()` is destructive and always acts. `memspec` cannot be combined with `diskOnly`; `quiesce` requires `diskOnly`.

## Change cdrom media

```ts
await changeDomainMedia({ name: 'guest', target: 'sda', action: 'eject' });
await changeDomainMedia({
  name: 'guest',
  target: 'sda',
  action: 'insert',
  source: '/images/seed.iso',
});
await changeDomainMedia({
  name: 'guest',
  target: 'sda',
  action: 'update',
  source: '/images/other.iso',
});
```

Mirrors `virsh change-media` (`--eject` / `--insert` / `--update <source>`, with `--live` + `--config` defaulting to true and optional `--force`). Returns true when media was changed; no-op when the drive already holds the desired state (ejected, or the same source). `insert`/`update` require `source` and `eject` forbids it — both validated client-side instead of forwarding virsh usage errors. Throws when no cdrom with `target` exists (floppy drives are outside the normalized model).

## Inspection

```ts
const domains = await listDomains();
// [{ name: 'guest', state: 'running' }, ...]

const state = await getDomainState({ name: 'guest' }); // 'running' | 'shutoff' | ...
const conf = await getDomain({ name: 'guest' }); // normalized DomainConf
const info = await getDomainInfo({ name: 'guest' });
// { id, state, vcpus, maxMemoryMiB, memoryMiB, persistent, autostart }

const xml = await getDomainXml({ name: 'guest', inactive: true }); // persistent config
const addrs = await getDomainIfAddr({ name: 'guest' }); // lease source by default
// [{ interface: 'vnet0', mac: '52:54:00:..', protocol: 'ipv4', address: '192.168.122.5/24' }, ...]
const agentAddrs = await getDomainIfAddr({ name: 'guest', source: 'agent' });
```

All operations accept an optional connection URI (`{ uri: 'qemu:///system' }`). When omitted, the virsh default connection is used.

## Configuration types

```ts
import type {
  DomainConf,
  DomainDisk,
  DomainFilesystem,
  DomainInterface,
  DomainInfo,
} from '@sysopkit/libvirt/domain';
import { domainConfigMatches, parseDomainXml, serializeDomainXml } from '@sysopkit/libvirt/domain';
```

- `serializeDomainXml(conf)` / `parseDomainXml(xml)` — build and read domain XML; `parseDomainXml` keeps only the modeled subset.
- `domainConfigMatches(current, desired)` — the drift check used by `defineDomain()`.
- `parseDomainList(output)` / `parseDomainInfo(output)` — parse `virsh list` / `dominfo` output.
- `parseSnapshotList(output)` / `parseDomainIfAddr(output)` — parse `virsh snapshot-list` / `domifaddr` output.
