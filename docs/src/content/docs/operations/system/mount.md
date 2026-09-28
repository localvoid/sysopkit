---
title: mount
description: Mount filesystems and manage fstab entries.
---

```ts
import { mount, parseFstab, serializeFstab } from 'sysopkit/op/mount';
```

## mount()

Mounts a filesystem at the given path (idempotent).

```ts
await mount({ src: '/dev/sdb1', path: '/mnt/data', fstype: 'ext4' });
```

Bind-mounts (idempotent via file identity — a bound path exposes the source's inode):

```ts
await mount({ src: '/srv/data', path: '/mnt/data', bind: true });
// installer API mounts: don't propagate submounts into the bind
await mount({ src: '/dev', path: '/target/dev', rslave: true });
```

## umount()

Detaches the mount at the given path (idempotent — skips when nothing is mounted).

```ts
await umount({ path: '/mnt/data' });
```

Recursive + lazy detach for retry cleanup and pre-reboot paths. The pre-check is submount-aware, so orphaned child mounts are detached even when `path` itself is no longer mounted; `ignoreErrors` turns a failed detach into a no-op instead of stranding the flow:

```ts
await umount({ path: '/target', recursive: true, lazy: true, ignoreErrors: true });
```

## parseFstab() / serializeFstab()

Parse fstab content into entries, or serialize entries back into fstab format.

```ts
const entries = parseFstab(existingContent);
entries.push({
  device: '/dev/sdb1',
  mountPoint: '/mnt/data',
  fsType: 'ext4',
  options: ['defaults'],
  dump: 0,
  pass: 2,
});
const newContent = serializeFstab(entries);
```
