# Shell ops: exec, sh, bash, which

```typescript
import { bash } from 'sysopkit/op/bash';
import { exec } from 'sysopkit/op/exec';
import { sh, $_ } from 'sysopkit/op/sh';
import { tryWhich, which } from 'sysopkit/op/which';

await exec(['systemctl', 'restart', 'nginx']); // raw argv, no throw, inspect exitCode
await sh('cat > file <<EOF\n…'); // runs via `sh -c`, throws ShellError
await bash('echo $EPOCHREALTIME'); // runs via `bash -c`
await which('parted'); // absolute path via `command -v`, throws when missing
if ((await tryWhich('cloud-init')) !== undefined) {
  // present — no throw on absence (still throws on malformed names)
}
```

`exec`, `sh`, and `bash` are **non-idempotent**: they run every time. Guard mutating commands with `if (!context().dryRun)` and emit your own change events.

- `exec(cmd[], opts?: { stdin?, stdout?: 'text' | 'buffer', stderr?, signal? })` requires `ctx.conn` and never throws; check `result.exitCode`.
- `sh`/`bash` throw `ShellError` (extends `ExecError`, carries `cmd`, `exitCode`, `stdout`, `stderr`) on a non-zero exit **except 64–78**, the BSD `sysexits` range reserved for control flow.

## Exit 64 means "not found"

Ops use the 64–78 exemption for probes: `tryReadFile` (`[ -f ] || exit 64`), `mountInfo` (maps 1→64). Check `exitCode` for probes instead of wrapping them in try/catch. Reserve 64–78 for control flow in your own scripts.

## Quote with `$_`

Interpolate paths with `$_()` inside `sh -c` strings:

```typescript
await sh(`cat > ${$_(path)} <<'EOF'\n${content}\nEOF`);
```

Bare interpolation breaks on spaces and quotes. `$_` passes `[a-zA-Z0-9_\-,.+:@%/]` through, so URLs and owners stay readable. SSH's `spawn` already escapes — never double-escape there.

## Probe, then wait

Polling lives in `waitUntil` ([utilities-errors](../utilities-errors.md#waituntil)). Keep probes cheap and exit-64-based:

```typescript
import { waitUntil } from 'sysopkit';

await waitUntil(async () => (await sh('pidof nginx || exit 64')).exitCode === 0, {
  describe: 'nginx active',
});
```

- File presence: `getPathInfo`.
- File content: `tryReadFile(p) ?? ''`.
- Ports: bash `/dev/tcp` or `nc -z -w 1`.
- Processes: exact-name `pidof`.
- Commands: `which`/`tryWhich`.
