---
title: curl
description: HTTP requests via curl.
---

```ts
import { curl } from 'sysopkit/op/curl';
```

## curl()

Makes HTTP requests via `curl`:

```ts
const result = await curl('https://api.example.com/data');
// { stdout, stderr, exitCode }
```

Supports all standard curl flags:

```ts
const result = await curl([
  '-X',
  'POST',
  '-H',
  'Content-Type: application/json',
  '-d',
  JSON.stringify({ key: 'value' }),
  'https://api.example.com/data',
]);
```
