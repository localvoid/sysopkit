---
title: curl
description: Make HTTP requests via curl.
---

```ts
import { curl } from 'sysopkit/op/curl';
```

## curl()

Downloads a URL to a local path (not idempotent — always downloads). Runs at trace verbosity (visible with `SYSOPKIT_VERBOSITY=trace`, grouped under your task at default verbosity). File mode emits a `curl downloaded` change event and is skipped in dry-run; omit `path` to capture the body as stdout instead of writing a file.

```ts
await curl({ url: 'https://example.com/file.tar.gz', path: '/tmp/file.tar.gz' });
```

```ts
const listing = await curl({
  url: 'https://mirror.example.com/releases/44/',
  fail: true,
  followRedirects: true,
});
```

Mirror-grade fetching — fail on HTTP errors and follow redirects (progress meter is silenced by default, errors still shown; pass `silent: false` to restore it):

```ts
await curl({
  url: 'https://mirror.example.com/releases/44/key',
  path: '/tmp/keys/RPM-GPG-KEY',
  fail: true,
  followRedirects: true,
});
```

All options (`CurlOptions`): `url`, `path` (omit to return stdout as `string` instead of writing a file), `user` (`-u`), `headers` (`-H`, repeatable), `cookies` (`-b`), `insecure` (`-k`), `fail` (`-f`), `followRedirects` (`-L`), `silent` (`-sS`, default true).
