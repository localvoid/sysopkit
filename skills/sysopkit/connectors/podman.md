# Podman connector

Runs commands in a container through the control plane's Podman: `podman exec -i <host> …cmd`. Set `type: 'pod'` in the inventory and put the container name in `host`, or construct `PodmanConnector` directly.

```typescript
import { PodmanConnector } from 'sysopkit/connector/podman';

await using pod = new PodmanConnector({ host: 'my-app' });
```

- `connect()` runs `podman inspect --format '{{.State.Status}}'` once (a cached `verified` flag) and requires `running`, else it throws `ConnectorError`. Dispose does no work, but keep `await using` for uniformity.
- `isReady()` is the side-effect-free form: `true` iff `running`, `false` otherwise, throwing only on abort. `waitForReady()` polls it.
- `-i` keeps stdin open, which the sudo and expect middlewares need.
- `rsh` is `['podman', 'exec', '-i']`. `rsync` builds `host:path` endpoints for SSH-style transports, so it cannot use Podman's `rsh`; transfer container files with `sh`/`tar` instead.

## argv is verbatim

Unlike [ssh](ssh.md), arguments pass through with **no shell join and no `$_` escaping**. Shell syntax needs an explicit `sh -c`, which is what the `sh`/`bash` ops do — prefer them over raw `spawn`:

```typescript
await sh('cat /etc/os-release'); // becomes podman exec -i c sh -c '…'
```

Pass raw argv. `$_` would insert literal quotes into the container command.
