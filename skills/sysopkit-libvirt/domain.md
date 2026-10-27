# Domains

```typescript
import {
  changeDomainMedia,
  createSnapshot,
  defineDomain,
  destroyDomain,
  getDomain,
  getDomainIfAddr,
  getDomainInfo,
  getDomainXml,
  listSnapshots,
  revertSnapshot,
  setDomainAutostart,
  shutdownDomain,
  startDomain,
  undefineDomain,
} from '@sysopkit/libvirt/domain';
```

## DomainConf

```typescript
await defineDomain({
  domain: {
    name: 'guest', memoryMiB: 2048, vcpus: 2,
    uuid?, // stable identity (<uuid>); round-tripped so redefines converge; unset matches anything
    arch?: 'x86_64' | 'aarch64', machine?: 'q35', type?: 'kvm' | 'qemu', cpuMode?: 'host-passthrough' | 'host-model',
    firmware?: 'bios' | { loader, template?, nvram?, secure? }, // explicit OVMF paths; secure maps to <loader secure='yes'|'no'> (undefined omits); default nvram /var/lib/libvirt/qemu/nvram/<name>_VARS.fd
    kernel?, initrd?, cmdline?, // direct kernel boot (<os>); initrd/cmdline require kernel
    bootDevices?: ['hd'], // default
    disks?: [{ source, target?, bus?: 'virtio' | 'scsi' | 'sata' | 'ide', format?: 'qcow2' | 'raw', discard?: 'unmap' | 'ignore', kind?: 'file' | 'block', device?: 'disk' | 'cdrom', readonly?, bootOrder? }],
    networks?: [{ type?: 'network' | 'bridge', source, model?: 'virtio' | 'e1000' | 'rtl8139', mac?, bootOrder? }],
    filesystems?: [{ source /* host dir */, target /* mount tag */, readonly? }], // 9p passthrough host shares; guest mounts `mount -t 9p <target> <path>`
    graphics?: { type: 'spice' | 'vnc', listen?: 'none' | 'localhost' } | 'none', // default spice/none
    video?: { model: 'cirrus'|'vga'|'vmvga'|'qxl'|'virtio'|'bochs'|'ramfb', vramKiB?, heads?, primary? },
    agent?: true, // qemu-guest-agent channel
    consoles?: true, // serial+console pty (default true)
  },
});
```

### Defaults and matching

- Disk targets default to `vdX`/`sdX` in order (`_targetSuffix`: a..z, aa..).
- Serializer output is fully explicit: defaulted bus/model/format/listen are written out. The parser keeps only the modeled subset.
- Seed cdrom: `{ device: 'cdrom', source: 'seed.iso', target: 'sda', bus: 'sata', readonly: true }`. An ejected drive parses as `source: ''`.
- `defineDomain` redefines only on drift, with unset fields as wildcards. A replacement define over an existing name requires the same explicit `<uuid>` — pass the `uuid` from `getDomain()`, or libvirt rejects it.

### Filesystems

9p `mount`/`passthrough` host-directory shares: `<driver type='path' wrpolicy='immediate'/>`, plus `<readonly/>` when `readonly: true`. Non-`mount` types (e.g. `ram`) throw client-side; use the raw XML path.

### Video

`<video><model type vram? heads? primary?/></video>`, first device only; multi-GPU passthrough is outside the model.

- Omitted → no `<video>` written; libvirt adds its default (usually `cirrus`). Use `virtio` for modern desktops.
- `vramKiB`/`heads` must be positive integers (client-side throw); `primary` maps to `yes`/`no`.
- Parse keeps only known models, so exotic guests still parse; bad `vram`/`heads` values are dropped.
- Match is by `model`, with unset `vramKiB`/`heads`/`primary` and unset `video` as wildcards.

### Firmware

Firmware-autoselection markup (`os/@firmware='efi'`, `os/<firmware>`, e.g. from `virt-install --boot uefi`) parses through its explicit `<loader>`/`<nvram>` pair and is never serialized.

To switch secure-boot variants (e.g. `OVMF_*_4M.secboot.qcow2` → `OVMF_*_4M.qcow2`; the distro-specific naming stays caller-side): `getDomain` → rewrite `firmware.loader`/`template`, set `secure: false` → `defineDomain` with the `uuid` from `getDomain`. `undefine --nvram` is still required first because VARS contents are incompatible.

## Lifecycle and inspection

- `startDomain` → `boolean` (true when started). `shutdownDomain` is ACPI and running-only. `destroyDomain` covers running/paused/crashed/dying.
- `undefineDomain({ removeNvram?, snapshotsMetadata? })`: `snapshotsMetadata` is required for inactive domains with snapshots.
- `setDomainAutostart({ autostart })` uses `dominfo`.
- `listDomains()` (`list --all`), `getDomainState()` (`domstate`), `getDomainInfo()` (`dominfo`: id/state/vcpus/memory/persistent/autostart), `getDomain()` (normalized conf), `getDomainXml({ inactive? })`. `--inactive` dumps the persistent config for snapshot verification.

## Snapshots

```typescript
await createSnapshot({ name, snapshot?, description?, diskOnly?, quiesce?, atomic?, memspec?, diskspecs? });
await revertSnapshot({ name, snapshot?, running?: 'running'|'paused', force?, resetNvram? });
await listSnapshots({ name }); // [{ name, creationTime /* raw string */, state }]
```

- `createSnapshot` is idempotent by name and returns a boolean.
- `quiesce` requires `diskOnly`; `memspec` forbids it. Both throw client-side.
- `memspec` → `--memspec [file=]…[,snapshot=…]`. `diskspecs: [{ disk, snapshot?, driver?, stype?, file? }]` → repeatable `--diskspec` (always prefixed, per man).
- `revertSnapshot` defaults to `--current` and always acts. `resetNvram` is for UEFI guests whose firmware variables changed since the snapshot.

## Cdrom media and addresses

```typescript
await changeDomainMedia({ name, target: 'sda', action: 'eject'|'insert'|'update', source?, live?, config?, force? });
await getDomainIfAddr({ name, interface?, source?: 'lease'|'agent'|'arp', full? });
```

- `live`/`config` default true.
- `insert`/`update` require `source`; `eject` forbids it (client-side throws).
- A no-op when already ejected or source-identical; throws when no cdrom with `target` exists.
- `getDomainIfAddr` returns `{ interface, mac, protocol, address? }` (`-` → `undefined`). First-IPv4 picking stays caller-side.

## Pure helpers

`serializeDomainXml`, `parseDomainXml`, `domainConfigMatches(current, desired)`, `parseDomainList`, `parseDomainInfo`, `parseSnapshotList`, `parseDomainIfAddr`, `normalizeDomainState`, `_snapshotMemspec`, `_snapshotDiskspec`.
