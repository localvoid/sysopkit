---
title: bash
description: Bash shell command execution and TCP port waiting.
---

```ts
import { bash, waitPort } from 'sysopkit/op/bash';
```

## bash()

Executes a command string via `bash -c`. Same exit code handling as `sh()`.

```ts
const result = await bash('for i in {1..3}; do echo $i; done');
```

## waitPort()

Waits for a TCP port to open or close using bash `/dev/tcp`:

```ts
await waitPort({ port: 80, host: 'localhost', state: 'open', delay: 1000 });
```

Options:

| Option  | Default     | Description            |
| ------- | ----------- | ---------------------- |
| `port`  | —           | Port number (required) |
| `host`  | `localhost` | Host to check          |
| `state` | `'open'`    | `'open'` or `'closed'` |
| `delay` | `5000`      | Poll interval in ms    |
