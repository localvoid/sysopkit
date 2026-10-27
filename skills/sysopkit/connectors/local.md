# Local connector

Runs commands on the control plane with `processSpawn`. No auth, no `connect()` work, no env handling.

```typescript
import { LocalConnector } from 'sysopkit/connector/local';

await using local = new LocalConnector(); // host='', name='local', rsh=[]
```

Use it to build artifacts, prepare local `rsync` endpoints, or query the machine running the playbook. `apply()` still drives it: it connects (a no-op), opens a connector frame, and runs `fn`. Keep `await using`.

The shared connector contract:

```typescript
interface Connector extends AsyncDisposable {
  readonly host: string;
  readonly name: string;
  readonly vars: Record<string | symbol, any> | undefined;
  readonly rsh: string[];
  connect(signal?: AbortSignal): Promise<void>;
  isReady(signal?: AbortSignal): Promise<boolean>; // always true here
  spawn(cmd: string[], signal?: AbortSignal): Promise<Process>;
}
```

`rsh` is the informational transport prefix — `[]` here — that `rsync` uses as `-e` (empty skips `-e`). See [ssh](ssh.md) for the multiplexed case and [podman](podman.md) for containers.

## Process contract

Every connector returns the same `Process`.

- WHATWG streams: `stdin: WritableStream`, `stdout`/`stderr: ReadableStream`; plus `exited: Promise<number>` and `kill(code?)`.
- `exited` resolves `code ?? 0`, so a signal-kill can look like success. Check `signal.aborted`.
- `processSpawn`/`processExec` never throw on a non-zero exit. Inspect `exitCode`, or use the `exec`/`sh` ops, which map it (`../ops/shell.md`).

## Rules

- No per-command env option and no shell wrapping: `spawn(['echo', '$HOME'])` passes a literal `$HOME`. Use `sh` for shell semantics.
- Local execution still runs inside the `apply` connector frame, so middleware (`sudo`, `trace`) and change tracking work unchanged.
