---
title: net
description: Parse and serialize `/etc/hosts` files.
---

```ts
import { parseHosts, serializeHosts } from 'sysopkit/op/net';
```

## parseHosts()

Parses `/etc/hosts` content into structured entries.

```ts
const entries = parseHosts(existingContent);
```

## serializeHosts()

Serializes hosts entries back into `/etc/hosts` format.

```ts
const content = serializeHosts([
  { ip: '127.0.0.1', aliases: ['localhost'] },
  { ip: '10.0.1.1', aliases: ['web-1'] },
]);
```
