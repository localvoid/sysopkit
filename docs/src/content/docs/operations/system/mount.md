---
title: mount
description: Filesystem mount operations and fstab management.
---

```ts
import { mount, parseFstab, serializeFstab } from 'sysopkit/op/mount';
```

## mount()

Mounts a filesystem:

```ts
await mount({ device: '/dev/sdb1', path: '/mnt/data', fstype: 'ext4' });
```

## parseFstab() / serializeFstab()

Parse or serialize fstab entries:

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
