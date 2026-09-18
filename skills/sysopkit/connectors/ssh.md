# SSH connector

```typescript
import { SSHConnector } from 'sysopkit/connector/ssh';
import { apply } from 'sysopkit';
```

The default connector — inventory hosts without a known prefix become
`SSHConnector`, and it is what `apply()` connects before running your function.

```typescript
await using ssh = new SSHConnector({
  host: '192.168.1.1', user: 'sysop', port?: 22, key?: '/path/id_ed25519',
  password?, timeout?: 5, strictHostKeyChecking?: boolean,
  controlMaster?: true, controlPersist?: '5m', authSocket?,
});
```

Never call `spawn()` yourself — `apply()` calls `connect()` then runs `fn`.
`spawn()` without a prior `connect()` silently skips multiplexing (see below).

## Auth

- Key path and password may combine (`-i` plus `ASKPASS`). No password →
  `BatchMode=yes IdentitiesOnly=yes`.
  Password → `NumberOfPasswordPrompts=1` plus a generated `SSH_ASKPASS` script
  (`echo $SYSOPKIT_SSH_PASSWORD`) with `SSH_ASKPASS_REQUIRE=force`.
- Key validation in `connect()`: `stat` must succeed and `mode & 0o077` must be
  0, else `ConnectorError` — fix with `chmod 600`.
- No passphrase-agent handling beyond the `authSocket` env passthrough
  (`SSH_AUTH_SOCKET`).

## ControlMaster (default on)

`connect()` creates `mkdtemp(sysopkit-ssh-<host>_)` holding the `connection`
socket + `askpass.sh`, and probes with `ssh … host exit`. `rsh` only includes
`ControlMaster=auto ControlPath=… ControlPersist=5m` **if `connect()` ran before
the first `rsh` read** (the value is cached). Dispose runs `ssh -O exit`
(errors swallowed) then `rm -rf` of the tempdir — always `await using`, or
sockets leak. Each instance gets its own tempdir/socket; nothing is shared
between instances.

## Failure diagnostics

On probe failure `connect()` re-runs once with `LogLevel=VERBOSE`, no
multiplexing, and throws `ConnectorError` combining both stderrs. Normal runs
use `LogLevel=ERROR`, which hides auth detail — check the combined error, not
the first stderr alone.

## spawn flattens to one shell string

The whole `cmd[]` becomes `cmd.map($_).join(' ')` executed as a single remote
shell command. Array boundaries are not preserved — remote shell parsing
applies. Do not pre-escape with `$_`; `spawn` already does.

## Pitfalls

- `strictHostKeyChecking: false` sets `StrictHostKeyChecking=no` +
  `UserKnownHostsFile=/dev/null` (MITM risk — throwaway labs only).
- `Process.exited` resolves `code ?? 0`, so a signal-kill can look like success —
  check `signal.aborted`.
- `processExec` never throws on non-zero exit; use the `exec`/`sh` ops or check
  `exitCode` yourself.
