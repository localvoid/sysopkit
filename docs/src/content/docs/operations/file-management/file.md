---
title: file
description: Idempotent file, directory, and symlink operations.
---

```ts
import {
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

Reads a file as string. `tryReadFile()` returns `undefined` if not found.

```ts
const content = await readFile('/etc/hostname');
const maybe = await tryReadFile('/etc/missing'); // undefined
```

## writeFile()

Writes content to a file using `cat >`. Not idempotent.

## touchFile()

> **IDEMPOTENT**

Updates timestamps via `touch`, creates file if missing.

## createDir() / deleteDir()

> **IDEMPOTENT**

Creates or removes directories:

```typescript
await createDir({ path: '/var/www', mode: 0o755, recursive: true });
await deleteDir({ path: '/tmp/old', recursive: true });
```

## createLink() / deleteLink()

> **IDEMPOTENT**

Creates or removes symbolic links. `createLink` compares target via `readlink`.

## getFileStat()

Returns file metadata: type, user, group, mode, timestamps, size.

## sha256()

Computes SHA256 hash of a file.

## waitFilePath()

Waits for a path to exist (with optional permission check).

## waitFileContent()

Waits for a file to contain or not-contain a regex pattern.
