---
title: file
description: Manage files, directories, and symlinks idempotently.
---

```ts
import {
  cp,
  createFile,
  deleteFile,
  readFile,
  writeFile,
  touchFile,
  createDir,
  deleteDir,
  createLink,
  deleteLink,
  getPathInfo,
  getFileStat,
  sha256,
  waitFilePath,
  waitFileContent,
} from 'sysopkit/op/file';
```

## createFile()

> **IDEMPOTENT**

Creates or updates a file. Compares content via SHA256, updates metadata only when changed.

```ts
await createFile({
  path: '/etc/nginx/nginx.conf',
  content: 'server { listen 80; }',
  mode: 0o644,
  user: 'nginx',
  group: 'nginx',
});
```

## deleteFile()

> **IDEMPOTENT**

Deletes a file. No-op if the file does not exist.

## readFile() / tryReadFile()

Reads a file as a string. `tryReadFile()` returns `undefined` if not found.

```ts
const content = await readFile('/etc/hostname');
const maybe = await tryReadFile('/etc/missing'); // undefined
```

## writeFile()

Writes content to a file using `cat >`. Not idempotent.

## touchFile()

> **IDEMPOTENT**

Updates timestamps via `touch`, creating the file if it is missing.

## createDir() / deleteDir()

> **IDEMPOTENT**

Creates or removes directories:

```ts
await createDir({ path: '/var/www', mode: 0o755, recursive: true });
await deleteDir({ path: '/tmp/old', recursive: true });
```

## createLink() / deleteLink()

> **IDEMPOTENT**

Creates or removes symbolic links. `createLink` compares target via `readlink`.

## cp()

Copies files or directories with `cp`. Always copies and emits a change event (non-idempotent, skipped in dry-run like `tar`). Accepts a single source or an array of sources copied into a destination directory:

```ts
await cp({ src: '/etc/app.conf', dst: '/backup/app.conf' });
await cp({ src: '/var/www', dst: '/backup/www', recursive: true, reflink: 'auto' });
await cp({ src: ['/etc/a.conf', '/etc/b.conf'], dst: '/backup/', force: true });
```

Options: `recursive` (`-r`), `force` (`-f`), `archive` (`-a`), `preserve` (`-p`), `reflink` / `sparse` (`--reflink=` / `--sparse=` with `always` | `auto` | `never`, GNU coreutils only).

## getFileStat()

Returns file metadata: type, user, group, mode, timestamps, size.

## sha256()

Computes the SHA256 hash of a file.

## waitFilePath()

Waits for a path to exist (with optional permission check).

## waitFileContent()

Waits for a file to contain or not-contain a regex pattern.
