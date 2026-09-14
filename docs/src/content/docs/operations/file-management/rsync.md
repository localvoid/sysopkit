---
title: rsync
description: Synchronize files with rsync, pushing to or pulling from the target.
---

```ts
import { rsyncPush, rsyncPull } from 'sysopkit/op/rsync';
```

## rsyncPush()

> **IDEMPOTENT**

Syncs a local path to the remote host and returns the resulting change entries.

```ts
const changes = await rsyncPush({
  src: '/local/path/',
  dst: '/remote/path/',
  flags: ['-az', '--delete'],
});
```

## rsyncPull()

> **IDEMPOTENT**

Syncs a remote path to the local host.

```ts
const changes = await rsyncPull({
  src: '/remote/path/',
  dst: '/local/path/',
});
```

## Options

| Option                 | Description                       |
| ---------------------- | --------------------------------- |
| `src`                  | Source path                       |
| `dst`                  | Destination path                  |
| `flags`                | Additional rsync flags            |
| `remove`               | Remove extra files on destination |
| `user` / `group`       | Ownership settings                |
| `usermap` / `groupmap` | User/group mapping                |
| `rsyncPath`            | Custom rsync binary path          |

Both functions return `RsyncEntry[]` with `type`, `action` (`sent`/`created`/`touched`/`deleted`), and `path` fields.
