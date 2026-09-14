---
title: tar
description: Create and extract archives on target hosts.
---

```ts
import { tar, untar } from 'sysopkit/op/tar';
```

## tar()

Creates an archive from a directory on the target host. Emits a change event on every run.

```ts
await tar({ src: '/var/www', dst: '/backup/www.tar.gz' });
```

## untar()

Extracts an archive into a directory on the target host. Emits a change event on every run.

```ts
await untar({ src: '/backup/www.tar.gz', dst: '/var/www' });
```

## Options

Both functions accept `src`, `dst`, and an optional `exclude` list of patterns passed through as `--exclude` flags:

```ts
await tar({ src: '/var/www', dst: '/backup/www.tar.gz', exclude: ['*.log'] });
```
