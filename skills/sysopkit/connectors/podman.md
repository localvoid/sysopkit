# Podman connector

```typescript
import { PodmanConnector } from 'sysopkit/connector/podman';
import { sh } from 'sysopkit/op/sh';
```

```typescript
await using pod = new PodmanConnector({ host: 'my-app' });
```

Selected by the `pod:` inventory prefix (`pod:postgres` → container `postgres`).
Executes via `podman exec -i <host> …cmd` on the control plane's podman.

- `connect()` runs `podman inspect --format '{{.State.Status}}'` once (cached
  `verified` flag) and requires `running`, else `ConnectorError`. No dispose
  work, but still use `await using` for uniformity.
- `-i` keeps stdin open (needed by the sudo/expect middlewares).
- `rsh` is `['podman', 'exec', '-i']`. `rsync` builds `host:path` endpoints for
  SSH-style transports, so it does not work over podman `rsh` — use `sh`/`tar`
  instead of `rsync` for container file transfer.

## Pitfall: argv is verbatim — no shell

Unlike [ssh](ssh.md), args pass through with **no shell join and no `$_`
escaping**. Shell syntax requires an explicit `sh -c`, which is exactly what
the `sh`/`bash` ops do — prefer them over raw `spawn`:

```typescript
await sh('cat /etc/os-release'); // works: becomes podman exec -i c sh -c '…'
```

Conversely, never pre-escape podman args with `$_` — it would insert literal
quotes into the container command.
