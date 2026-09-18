# Shell ops: exec, sh, bash

```typescript
import { exec } from 'sysopkit/op/exec';
import { sh, $_, ShellError } from 'sysopkit/op/sh';
import { bash } from 'sysopkit/op/bash';
```

```typescript
import { exec } from 'sysopkit/op/exec';
import { sh, $_ } from 'sysopkit/op/sh';
import { bash } from 'sysopkit/op/bash';

await exec(['systemctl', 'restart', 'nginx']); // raw argv, no throw, inspect exitCode
await sh('cat > file <<EOF\n…');               // runs via `sh -c`, throws ShellError
await bash('echo $EPOCHREALTIME');             // runs via `bash -c`
```

All three are **non-idempotent** — they run every time. Guard with
`if (!context().dryRun)` and track changes yourself when the command mutates.

- `exec(cmd[], opts?: { stdin?, stdout?: 'text'|'buffer', stderr?, signal? })`
  requires `ctx.conn` and never throws — check `result.exitCode`.
- `sh`/`bash` throw `ShellError` (extends `ExecError` with `cmd`, `exitCode`,
  `stdout`, `stderr`) on non-zero exit **except 64–78** — BSD `sysexits` codes
  reserved for control flow.

## Exit 64 means "not found"

Ops exploit the 64–78 exemption for probes: `tryReadFile` (`[ -f ] || exit 64`),
`mountInfo` (maps 1→64), `waitFileContent` (`grep -q || exit 64`),
`waitPort`/`waitProcess`. Never use 64–78 for real errors in your own scripts;
check `exitCode` manually for probes instead of try/catch.

## Quoting with `$_`

Always interpolate paths with `$_()` inside `sh -c` strings:

```typescript
await sh(`cat > ${$_(path)} <<'EOF'\n${content}\nEOF`);
```

Bare interpolation breaks on spaces/quotes. `$_` passes
`[a-zA-Z0-9_\-,.+:@%/]` through, so URLs/owners stay readable. The SSH
connector's `spawn` already escapes — never double-escape there.

## Polling: waitPort, waitProcess, waitFile*

Read-only poll loops (`ctx.signal.throwIfAborted() + sleep`, abort-aware):

- `bash.waitPort({ port, host?: 'localhost', state?: 'open'|'close', delay? })`
  via `/dev/tcp`; `netcat.waitPort(...)` via `nc -z -w 1`. Two different
  `waitPort`s — import from the explicit path.
- `proc.waitProcess({ process, state?: 'active'|'terminated', delay? })` via
  exact-name `pidof`.
- `file.waitFilePath({ path, perm?, delay? })`,
  `file.waitFileContent({ path, regex, state?: 'present'|'absent', delay? })`.
