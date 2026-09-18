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
  flags: ['-az'],
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

| Option                 | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `src`                  | Source path                                              |
| `dst`                  | Destination path                                         |
| `flags`                | Additional rsync flags (default Archive `-a` when unset) |
| `remove`               | Remove extra files on destination (default `true` → `--delete`; pass `remove: false` to keep them) |
| `user` / `group`       | Ownership settings                                       |
| `usermap` / `groupmap` | User/group mapping                                       |
| `rsyncPath`            | Custom rsync binary path                                 |

Both functions return `RsyncEntry[]` with `type`, `action` (`sent`/`created`/`touched`/`deleted`), and `path` fields.

Runs locally with `conn.rsh` as the `-e` transport (SSH-style transports only — not valid for podman `rsh`; use `sh`/`tar` for container file transfer). `--dry-run` is appended automatically in dry-run mode.
