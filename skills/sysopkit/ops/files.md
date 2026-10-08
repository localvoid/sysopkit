# File ops: files, rsync, tar, curl, temp

```typescript
import { curl } from 'sysopkit/op/curl';
import { createFile, createDir, createLink, cp, sha256 } from 'sysopkit/op/file';
import { rsyncPush, rsyncPull } from 'sysopkit/op/rsync';
import { tar, untar } from 'sysopkit/op/tar';
import { withTempFile, withTempDir } from 'sysopkit/op/temp';
```

## Idempotent file ops (`sysopkit/op/file`)

```typescript
import { createFile, createDir, createLink, deleteFile, cp, sha256 } from 'sysopkit/op/file';

await createFile({ path: '/etc/app.conf', content, mode?, user?, group?, atime?, mtime?, attributes? });
await createDir({ path: '/var/lib/app', recursive?, mode?, user?, group? });
await createLink({ path: '/etc/app.current', target: '/etc/app.v2' });
await cp({ src: '/var/www', dst: '/backup/www', recursive?, force?, archive?, preserve?, reflink?, sparse? });
```

`createFile`, `createDir`, `createLink`, `deleteFile`, `deleteDir`, `deleteLink`, `touchFile` are **idempotent**: check-then-act via `getPathInfo` bitmask, local-vs-remote `sha256` comparison, `readlink`/`stat` diffs; only `chmod/chown/touch/chattr/mkdir/ln/rm` on diff, `emitChanged()` only on real change. In dry-run they check state and emit, but skip mutation. `content` may be string or bytes.

`cp` is a **non-idempotent** task: it always copies (single `src` or `src[]` into a directory) and emits `copied`, skipping the command in dry-run like `tar`. `reflink`/`sparse` (`always` | `auto` | `never`) are GNU-only — unavailable on busybox targets.

Read-only helpers (run even in dry-run): `getPathInfo`, `readFile` / `readFileBuffer` (throw) and `tryReadFile` / `tryReadFileBuffer` (`undefined` on exit 64), `getFileStat`, `sha256`.

**Pitfall:** `deleteDir({ recursive: true })` is `rm -fr` — double-check `path`.

## rsync (`sysopkit/op/rsync`)

```typescript
await rsyncPush({ src: './dist/', dst: '/srv/app', flags?, remove?, user?, group? });
await rsyncPull({ src: '/var/log/app/', dst: './logs' });
```

Idempotent (`-ivz --itemize-changes`, default `-a`). Runs **locally** via a spawned `rsync` with `dst/src=${conn.host}:…` and `conn.rsh` as `-e`. `--dry-run` is appended automatically in dry-run. SSH-style transports only — podman `rsh` is not a valid rsync `-e` transport (see [podman](../connectors/podman.md)).

**Pitfall:** adds `--delete` unless `remove: false` — that default is destructive.

## tar, curl

```typescript
await tar({ src: '/srv/app', dst: '/backup/app.tar.gz', exclude? });
await untar({ src: '/backup/app.tar.gz', dst: '/srv/app' });
await curl({ url, path, user?, headers?, cookies?, insecure?, fail?, followRedirects?, silent? });
```

Both **non-idempotent**. `tar`/`untar` skip the command in dry-run but still emit `packed`/`extracted`. `curl` (`curl [-f -L -sS -u -H -b -k] -o path url`) has **no** dry-run guard — it always downloads. `fail` (`-f`) throws on HTTP >=400 instead of saving the error page, `followRedirects` (`-L`) follows 302s, `silent` (`-sS`, default true) hides progress but keeps errors.

## temp files and dirs (`sysopkit/op/temp`)

```typescript
await withTempFile(
  async (path) => {
    await sh(`virsh define ${$_(path)}`);
  },
  { content: xml, template? },
);
await withTempDir(async (dir) => { /* stage files, read results back */ });
```

`mktemp` + optional `content` write, callback, `rm -f` / `rm -rf` in `finally` (cleanup survives callback throws). Bare plumbing like `writeFile`: no `dryRun` check, no change events — gate and report in your own task. Cleanup needs a live connection (`/tmp` aging reclaims orphans after a mid-op disconnect).

**Pitfall:** never substitute `cmd /dev/stdin` with `stdin` content for file-needing commands — child stdio may be a socket, which fails reopen-by-path with ENXIO while the orphaned parent write dies with EPIPE. This is why the libvirt package stages XML through temp files.
