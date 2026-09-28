---
title: which
description: Resolve tool paths via `command -v`.
---

```ts
import { which, resolveTools } from 'sysopkit/op/which';
```

## which()

Resolves one tool name to an absolute path. Throws when the tool is not installed — paths drift across releases, so resolve at runtime instead of hardcoding.

```ts
const shPath = await which('sh');
```

## resolveTools()

Resolves several tool names to absolute paths, in order. Throws on the first missing tool.

```ts
const [parted, wipefs] = await resolveTools(['parted', 'wipefs']);
```
