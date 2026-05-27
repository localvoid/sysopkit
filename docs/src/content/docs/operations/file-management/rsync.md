---
title: rsync
description: File synchronization via rsync (push and pull).
---

```ts
import { rsyncPush, rsyncPull } from 'sysopkit/op/rsync';
```

## rsyncPush()

> **IDEMPOTENT**

Syncs local to remote. Returns array of change entries.

```ts
const changes = await rsyncPush({
  src: '/local/path/',
  dst: '/remote/path/',
  flags: ['-az', '--delete'],
});
```

## rsyncPull()

> **IDEMPOTENT**

Syncs remote to local.

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

Return type: `RsyncEntry[]` with `type`, `action` (sent/created/touched/deleted), and `path`.
