# File ops: files, rsync, tar, curl

```typescript
import { createFile, createDir, createLink, sha256 } from 'sysopkit/op/file';
import { rsyncPush, rsyncPull } from 'sysopkit/op/rsync';
import { tar, untar } from 'sysopkit/op/tar';
import { curl } from 'sysopkit/op/curl';
```

## Idempotent file ops (`sysopkit/op/file`)

```typescript
import { createFile, createDir, createLink, deleteFile, sha256 } from 'sysopkit/op/file';

await createFile({ path: '/etc/app.conf', content, mode?, user?, group?, atime?, mtime?, attributes? });
await createDir({ path: '/var/lib/app', recursive?, mode?, user?, group? });
await createLink({ path: '/etc/app.current', target: '/etc/app.v2' });
```

`createFile`, `createDir`, `createLink`, `deleteFile`, `deleteDir`,
`deleteLink`, `touchFile` are **idempotent**: check-then-act via `getPathInfo`
bitmask, local-vs-remote `sha256` comparison, `readlink`/`stat` diffs; only
`chmod/chown/touch/chattr/mkdir/ln/rm` on diff, `emitChanged()` only on real
change. In dry-run they check state and emit, but skip mutation. `content` may
be string or bytes.

Read-only helpers (run even in dry-run): `getPathInfo`, `readFile` /
`readFileBuffer` (throw) and `tryReadFile` / `tryReadFileBuffer` (`undefined`
on exit 64), `getFileStat`, `sha256`.

**Pitfall:** `deleteDir({ recursive: true })` is `rm -fr` — double-check `path`.

## rsync (`sysopkit/op/rsync`)

```typescript
await rsyncPush({ src: './dist/', dst: '/srv/app', flags?, remove?, user?, group? });
await rsyncPull({ src: '/var/log/app/', dst: './logs' });
```

Idempotent (`-ivz --itemize-changes`, default `-a`). Runs **locally** via
a spawned `rsync` with `dst/src=${conn.host}:…` and `conn.rsh` as `-e`.
`--dry-run` is appended automatically in dry-run. SSH-style transports only —
podman `rsh` is not a valid rsync `-e` transport (see [podman](../connectors/podman.md)).

**Pitfall:** adds `--delete` unless `remove: false` — that default is
destructive.

## tar, curl

```typescript
await tar({ src: '/srv/app', dst: '/backup/app.tar.gz', exclude? });
await untar({ src: '/backup/app.tar.gz', dst: '/srv/app' });
await curl({ url, path, user?, headers?, cookies?, insecure? });
```

Both **non-idempotent**. `tar`/`untar` skip the command in dry-run but still
emit `packed`/`extracted`. `curl` (`curl [-u -H -b -k] -o path url`) has **no**
dry-run guard — it always downloads.
