# Domains: `@sysopkit/libvirt/domain`

```typescript
import {
  defineDomain,
  undefineDomain,
  startDomain,
  shutdownDomain,
  destroyDomain,
  setDomainAutostart,
  createSnapshot,
  revertSnapshot,
  listSnapshots,
  changeDomainMedia,
  getDomIfAddr,
  getDomain,
  getDomainXml,
  getDomainInfo,
} from '@sysopkit/libvirt/domain';
```

## DomainConf (normalized model)

```typescript
await defineDomain({
  domain: {
    name: 'guest', memoryMiB: 2048, vcpus: 2,
    arch?: 'x86_64', machine?: 'q35', type?: 'kvm', cpuMode?: 'host-passthrough',
    firmware?: 'bios' | { loader, template?, nvram? }, // explicit OVMF paths; default nvram /var/lib/libvirt/qemu/nvram/<name>_VARS.fd
    bootDevices?: ['hd'], // default
    disks: [{ source, target?, bus?: 'virtio', format?: 'qcow2', kind?: 'file', device?: 'disk'|'cdrom', readonly?, bootOrder? }],
    networks: [{ type?: 'network', source, model?: 'virtio', mac?, bootOrder? }],
    graphics?: { type: 'spice'|'vnc', listen?: 'none' } | 'none', // default spice/none
    agent?: true, // qemu-guest-agent channel
    consoles?: true, // serial+console pty (default true)
  },
});
```

Disk targets default to `vdX`/`sdX` in order (`_targetSuffix`: a..z, aa..). Serializer output is fully explicit (defaulted bus/model/format/listen written out); the parser keeps only the modeled subset. Seed cdrom: `{ device: 'cdrom', source: 'seed.iso', target: 'sda', bus: 'sata', readonly: true }` — an ejected drive parses as `source: ''`.

## Lifecycle and inspection

- `startDomain` → `boolean` (true when started); `shutdownDomain` (ACPI, running only); `destroyDomain` (running/paused/crashed/dying); `undefineDomain({ removeNvram?, snapshotsMetadata? })` — the latter is required for inactive domains with snapshots.
- `setDomainAutostart({ autostart })` via `dominfo`.
- `listDomains()` (`list --all` table), `getDomainState()` (`domstate`), `getDomainInfo()` (`dominfo`: id/state/vcpus/memory/persistent/autostart), `getDomain()` (normalized conf), `getDomainXml({ inactive? })` — `--inactive` dumps the persistent config for snapshot verification.

## Snapshots

```typescript
await createSnapshot({ name, snapshot?, description?, diskOnly?, quiesce?, atomic?, memspec?, diskspecs? });
await revertSnapshot({ name, snapshot?, running?: 'running'|'paused', force?, resetNvram? });
await listSnapshots({ name }); // [{ name, creationTime /* raw string */, state }]
```

`createSnapshot` is idempotent by name (returns boolean); `quiesce` requires `diskOnly`, `memspec` forbids it (both throw client-side). `memspec` → `--memspec [file=]…[,snapshot=…]`; `diskspecs: [{ disk, snapshot?, driver?, stype?, file? }]` → repeatable `--diskspec` (always prefixed, per man). `revertSnapshot` defaults to `--current` and always acts; `resetNvram` is for UEFI guests whose firmware variables changed since the snapshot.

## Cdrom media and addresses

```typescript
await changeDomainMedia({ name, target: 'sda', action: 'eject'|'insert'|'update', source?, live?, config?, force? });
await getDomIfAddr({ name, interface?, source?: 'lease'|'agent'|'arp', full? });
```

`live`/`config` default true. `insert`/`update` require `source`, `eject` forbids it (client-side throws); no-op when already ejected or source-identical; throws when no cdrom with `target` exists. `getDomIfAddr` returns `{ interface, mac, protocol, address? }` (`-` → `undefined`); first-IPv4 picking stays caller-side.

## Pure helpers (unit-testable)

`serializeDomainXml`, `parseDomainXml`, `domainConfigMatches(current, desired)`, `parseDomainList`, `parseDomainInfo`, `parseSnapshotList`, `parseDomIfAddr`, `normalizeDomainState`, `_snapshotMemspec`, `_snapshotDiskspec`. Op command strings are never asserted in tests (see repo `tests/AGENTS.md`); e2e for virsh ops needs a libvirtd host, excluded like other daemon ops.
