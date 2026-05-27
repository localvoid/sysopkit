---
title: net
description: Network configuration — hosts file management.
---

```ts
import { parseHosts, serializeHosts } from 'sysopkit/op/net';
```

## parseHosts()

Parses `/etc/hosts` format:

```ts
const entries = parseHosts(existingContent);
```

## serializeHosts()

Serializes hosts entries to string:

```ts
const content = serializeHosts([
  { ip: '127.0.0.1', aliases: ['localhost'] },
  { ip: '10.0.1.1', aliases: ['web-1'] },
]);
```
