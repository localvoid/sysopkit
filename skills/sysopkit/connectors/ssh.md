# SSH connector

The default connector: inventory hosts with `type` absent (or `ssh`) become `SSHConnector`, and it is what `apply()` connects before running your function.

```typescript
import { SSHConnector } from 'sysopkit/connector/ssh';

await using ssh = new SSHConnector({
  host: '192.168.1.1', user: 'sysop', port?: 22, key?: '/path/id_ed25519',
  password?, timeout?: 5, strictHostKeyChecking?: boolean,
  controlMaster?: true, controlPersist?: '5m', authSocket?,
});
```

Let `apply()` drive it: `apply()` calls `connect()` and then `fn`. A direct `spawn()` before `connect()` silently skips multiplexing.

## Auth

- Key and password combine (`-i` plus `ASKPASS`). No password → `BatchMode=yes IdentitiesOnly=yes`. Password → `NumberOfPasswordPrompts=1` plus a generated `SSH_ASKPASS` script (`echo $SYSOPKIT_SSH_PASSWORD`) with `SSH_ASKPASS_REQUIRE=force`.
- `connect()` validates the key: `stat` must succeed and `mode & 0o077` must be 0, else `ConnectorError`. Fix with `chmod 600`.
- SSH agent access is limited to the `authSocket` env passthrough (`SSH_AUTH_SOCKET`); the connector does not handle passphrase prompts.

## ControlMaster (default on)

`connect()` creates `mkdtemp(sysopkit-ssh-<host>_)` holding the `connection` socket and `askpass.sh`, then probes with `ssh … host exit`. `rsh` includes `ControlMaster=auto ControlPath=… ControlPersist=5m` only if `connect()` ran before the first `rsh` read — the value is cached. Dispose runs `ssh -O exit` (errors swallowed) then `rm -rf` of the tempdir. Always `await using`, or sockets leak. Each instance gets its own tempdir and socket; nothing is shared.

A failed `connect()` removes its tempdir and drops multiplex state, so a manual retry allocates fresh resources instead of leaking. For boot and wait flows, prefer `waitForReady(new SSHConnector({…}))`: `isReady()` is a multiplex-free `ssh <host> exit` probe with a short `ConnectTimeout`, no tempdir, and no state mutation; it returns `false` on a non-zero exit and throws only on abort or misuse.

## Failure diagnostics

On probe failure `connect()` re-runs once with `LogLevel=VERBOSE`, no multiplexing, and throws `ConnectorError` combining both stderrs. Normal runs use `LogLevel=ERROR`, which hides auth detail — read the combined error, not the first stderr alone.

## spawn flattens to one shell string

The whole `cmd[]` becomes `cmd.map($_).join(' ')`, executed as a single remote shell command. Array boundaries are lost; the remote shell parses it. Pass raw argv: `spawn` escapes each element with `$_`.

## Rules

- `strictHostKeyChecking: false` sets `StrictHostKeyChecking=no` and `UserKnownHostsFile=/dev/null`. That is an MITM risk; use it in throwaway labs only.
- The process contract (`exited` resolving `code ?? 0`, non-throwing spawn helpers) is in [local](local.md#process-contract).

## Rotate host keys

`disableStrictHostKeyChecking()` downgrades subsequently established connections to lax — the same flags as `strictHostKeyChecking: false`. It is one-way (no re-enable), and a live master stays strict until it dies. Log the downgrade through the current context (`ctx.warn(...)`). Use `updateConnectorOptions()` with `instanceof` narrowing so it works through middleware:

```typescript
import { updateConnectorOptions } from 'sysopkit';
import { SSHConnector } from 'sysopkit/connector/ssh';

updateConnectorOptions((conn) => {
  if (conn instanceof SSHConnector) conn.disableStrictHostKeyChecking();
  else throw new Error(`refusing: unsupported connector '${conn.name}'`);
});
```

Before reconnecting to a host with fresh keys, drop its stale `known_hosts` entry (`ssh-keygen -R`, controller-local, no apply frame needed):

```typescript
import { removeKnownHost } from 'sysopkit/connector/ssh';

await removeKnownHost('192.168.122.93');
```
