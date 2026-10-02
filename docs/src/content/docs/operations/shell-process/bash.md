---
title: bash
description: Run commands with bash.
---

```ts
import { bash } from 'sysopkit/op/bash';
```

## bash()

Executes a command string via `bash -c`. Same exit code handling as `sh()`.

```ts
const result = await bash('for i in {1..3}; do echo $i; done');
```

Poll TCP ports with `waitUntil()` (see Utilities), e.g. via bash `/dev/tcp` or `nc -z`.
