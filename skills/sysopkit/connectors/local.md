# Local connector

```typescript
import { LocalConnector } from 'sysopkit/connector/local';
import { exec } from 'sysopkit/op/exec';
```

```typescript
await using local = new LocalConnector(); // host='', name='local', rsh=[]
```

Direct `processSpawn(cmd, signal)` on the control plane. No auth, no
`connect()` work, no env handling. Use for control-plane-local work (building
artifacts, local `rsync` endpoint prep, querying the machine running the
playbook).

Same lifecycle rules as every connector: `apply()` connects (no-op here) then
runs `fn`; always `await using`. The shared interface:

```typescript
interface Connector extends AsyncDisposable {
  readonly host: string; readonly name: string;
  readonly vars: Record<string | symbol, any> | undefined;
  readonly rsh: string[];
  connect(signal?: AbortSignal): Promise<void>;
  spawn(cmd: string[], signal?: AbortSignal): Promise<Process>;
}
```

`rsh` is the informational transport prefix — `[]` here — consumed by `rsync`
as its `-e` command (empty `rsh` skips `-e`). See [ssh](ssh.md) for the multiplexed case and
[podman](podman.md) for the container case.

## Process plumbing

- `Process` uses WHATWG streams (`stdin: WritableStream`,
  `stdout/stderr: ReadableStream`, `exited: Promise<number>`, `kill(code?)`).
- `exited` resolves `code ?? 0`, so a signal-kill can look like success — check
  `signal.aborted`.
- `processExec` never throws on non-zero exit; inspect `exitCode` (or use the
  `exec`/`sh` ops, which map it — see `../ops/shell.md`).

## Pitfalls

- No env passthrough and no shell wrapping: `spawn(['echo', '$HOME'])` passes a
  literal `$HOME` — use the `sh` op for shell semantics.
- Local execution still runs inside the `apply` connector context, so
  middleware (`sudo`, `trace`) and change tracking work unchanged.
