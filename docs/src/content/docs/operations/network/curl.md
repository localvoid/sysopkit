---
title: curl
description: Make HTTP requests via curl.
---

```ts
import { curl } from 'sysopkit/op/curl';
```

## curl()

Downloads a URL to a local path (not idempotent — always downloads).

```ts
await curl({ url: 'https://example.com/file.tar.gz', path: '/tmp/file.tar.gz' });
```

Mirror-grade fetching — fail on HTTP errors, follow redirects, silence the progress meter while keeping error output:

```ts
await curl({
  url: 'https://mirror.example.com/releases/44/key',
  path: '/tmp/keys/RPM-GPG-KEY',
  fail: true,
  followRedirects: true,
  silent: true,
});
```

All options (`CurlOptions`): `url`, `path`, `user` (`-u`), `headers` (`-H`, repeatable), `cookies` (`-b`), `insecure` (`-k`), `fail` (`-f`), `followRedirects` (`-L`), `silent` (`-sS`).
