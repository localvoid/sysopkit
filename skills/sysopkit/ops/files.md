# File ops: files, rsync, tar, curl, temp

## Idempotent file ops

```typescript
import { createDir, createFile, createLink, deleteFile } from 'sysopkit/op/file';

await createFile({ path: '/etc/app.conf', content, mode?, user?, group?, atime?, mtime?, attributes? });
await createDir({ path: '/var/lib/app', recursive?, mode?, user?, group? });
await createLink({ path: '/etc/app.current', target: '/etc/app.v2' });
await deleteFile({ path: '/etc/app.conf' });
```

`createFile`, `createDir`, `createLink`, `deleteFile`, `deleteDir`, and `deleteLink` are **idempotent**. They check-then-act with a `getPathInfo` bitmask, local-vs-remote `sha256` comparison, and `readlink`/`stat` diffs, running only `chmod/chown/touch/chattr/mkdir/ln/rm` on a diff. `emitChanged()` fires only on real change; in dry-run they check state and emit but skip mutation. `content` may be a string or bytes.

`cp` is a **non-idempotent** task: it always copies (a single `src` or `src[]` into a directory) and emits `copied`, skipping the command in dry-run like `tar`.

```typescript
await cp({ src: '/var/www', dst: '/backup/www', recursive?, force?, archive?, preserve?, reflink?, sparse? });
```

`reflink`/`sparse` (`always` | `auto` | `never`) are GNU-only; busybox targets lack them.

`touchFile` is not quiet: it always runs `touch` and emits `touched`, so the second run still reports a change. Gate it if you use it.

Read-only helpers run even in dry-run: `getPathInfo`, `readFile`/`readFileBuffer` (throw), `tryReadFile`/`tryReadFileBuffer` (`undefined` on exit 64), `getFileStat`, `sha256`, `sha512`, and `findFiles`.

## findFiles

Lists paths without mutating. Uses GNU `find -printf` with NUL-separated `%y`/`%p` pairs, so spaces and newlines in names are safe. A missing `dir` returns `[]`. Pair it with the typed deleters:

```typescript
import { deleteFile, findFiles } from 'sysopkit/op/file';

const keys = await findFiles({ dir: '/etc/ssh', maxDepth: 1, name: 'ssh_host_*' });
for (const f of keys) await deleteFile({ path: f.path }); // f: { path, type: PathType }
```

Options: `minDepth`/`maxDepth`; `name` (glob or globs, ORed); `type` (`PathType` or array, ORed); `followSymlinks` (`find -L`, default false — so `-type l` matches broken links only).

Verify `path` before `deleteDir({ recursive: true })`; it is `rm -fr`.

## rsync

```typescript
import { rsyncPull, rsyncPush } from 'sysopkit/op/rsync';

await rsyncPush({ src: './dist/', dst: '/srv/app', flags?, remove?, user?, group? });
await rsyncPull({ src: '/var/log/app/', dst: './logs' });
```

Idempotent (`-ivz --itemize-changes`, default `-a`). Runs **locally** through a spawned `rsync`, with `dst/src=${conn.host}:…` and `conn.rsh` as `-e`; `--dry-run` is appended automatically in dry-run. SSH-style transports only — Podman's `rsh` is not a valid rsync `-e` ([podman](../connectors/podman.md)).

`remove: false` is required to keep the destination's extra files; otherwise rsync adds `--delete`.

## tar and curl

```typescript
import { curl } from 'sysopkit/op/curl';
import { tar, untar } from 'sysopkit/op/tar';

await tar({ src: '/srv/app', dst: '/backup/app.tar.gz', exclude? });
await untar({ src: '/backup/app.tar.gz', dst: '/srv/app' });
await curl({ url, path, user?, headers?, cookies?, insecure?, fail?, followRedirects?, silent? });
```

These are **non-idempotent**. `tar`/`untar` skip the command in dry-run but still emit `packed`/`extracted`. `curl` (`curl [-f -L -sS -u -H -b -k] -o path url`) emits the change and skips the download in dry-run when `path` is set; without `path` it fetches to stdout. `fail` (`-f`) throws on HTTP ≥ 400 instead of saving the error page; `followRedirects` (`-L`) follows 302s; `silent` (`-sS`, default true) hides progress but keeps errors.

## Temp files and dirs

```typescript
import { $_, sh } from 'sysopkit/op/sh';
import { withTempDir, withTempFile } from 'sysopkit/op/temp';

await withTempFile(
  async (path) => {
    await sh(`virsh define ${$_(path)}`);
  },
  { content: xml, template? },
);
await withTempDir(async (dir) => { /* stage files, read results back */ });
```

`mktemp` + optional `content` write, callback, then `rm -f`/`rm -rf` in `finally` (cleanup survives a callback throw). Bare plumbing like `writeFile`: no `dryRun` check and no change events, so gate and report in your own task. Cleanup needs a live connection; `/tmp` aging reclaims orphans after a mid-op disconnect.

Stage through a real file for file-needing commands. `cmd /dev/stdin` with `stdin` content can fail: child stdio may be a socket, which cannot be reopened by path (ENXIO), and the orphaned parent write dies with EPIPE. The libvirt package stages XML through temp files for this reason.
