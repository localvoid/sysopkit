---
title: netcat
description: TCP port checking via netcat.
---

```ts
import { waitPort } from 'sysopkit/op/netcat';
```

## waitPort()

Waits for a TCP port to become reachable using netcat:

```ts
await waitPort({ host: '10.0.1.1', port: 80, delay: 1000 });
```

Options:

| Option  | Default | Description            |
| ------- | ------- | ---------------------- |
| `host`  | —       | Target host (required) |
| `port`  | —       | Target port (required) |
| `delay` | `5000`  | Poll interval in ms    |
