---
title: mount
description: Mount filesystems and manage fstab entries.
---

```ts
import { mount, parseFstab, serializeFstab } from 'sysopkit/op/mount';
```

## mount()

Mounts a filesystem at the given path.

```ts
await mount({ device: '/dev/sdb1', path: '/mnt/data', fstype: 'ext4' });
```

## parseFstab() / serializeFstab()

Parse fstab content into entries, or serialize entries back into fstab format.

```ts
const entries = parseFstab(existingContent);
entries.push({
  spec: '/dev/sdb1',
  file: '/mnt/data',
  vfsType: 'ext4',
  opts: 'defaults',
  dump: 0,
  pass: 2,
});
const newContent = serializeFstab(entries);
```
