# Shell ops: exec, sh, bash, which

```typescript
import { bash } from 'sysopkit/op/bash';
import { exec } from 'sysopkit/op/exec';
import { sh, $_, ShellError } from 'sysopkit/op/sh';
import { tryWhich, which, resolveTools } from 'sysopkit/op/which';
```

```typescript
import { bash } from 'sysopkit/op/bash';
import { exec } from 'sysopkit/op/exec';
import { sh, $_ } from 'sysopkit/op/sh';

await exec(['systemctl', 'restart', 'nginx']); // raw argv, no throw, inspect exitCode
await sh('cat > file <<EOF\n…'); // runs via `sh -c`, throws ShellError
await bash('echo $EPOCHREALTIME'); // runs via `bash -c`
await which('parted'); // absolute path via `command -v`, throws when missing
if ((await tryWhich('cloud-init')) !== undefined) {
  // present — no throw on absence (still throws on malformed names)
}
```

All three are **non-idempotent** — they run every time. Guard with `if (!context().dryRun)` and track changes yourself when the command mutates.

- `exec(cmd[], opts?: { stdin?, stdout?: 'text'|'buffer', stderr?, signal? })` requires `ctx.conn` and never throws — check `result.exitCode`.
- `sh`/`bash` throw `ShellError` (extends `ExecError` with `cmd`, `exitCode`, `stdout`, `stderr`) on non-zero exit **except 64–78** — BSD `sysexits` codes reserved for control flow.

## Exit 64 means "not found"

Ops exploit the 64–78 exemption for probes: `tryReadFile` (`[ -f ] || exit 64`), `mountInfo` (maps 1→64). Never use 64–78 for real errors in your own scripts; check `exitCode` manually for probes instead of try/catch.

## Quoting with `$_`

Always interpolate paths with `$_()` inside `sh -c` strings:

```typescript
await sh(`cat > ${$_(path)} <<'EOF'\n${content}\nEOF`);
```

Bare interpolation breaks on spaces/quotes. `$_` passes `[a-zA-Z0-9_\-,.+:@%/]` through, so URLs/owners stay readable. The SSH connector's `spawn` already escapes — never double-escape there.

## Polling with waitUntil

Reboot-tolerant predicate wait (`false` + default-retryable throws are "not yet", fail-closed at `timeoutMs`):

```typescript
import { waitUntil } from 'sysopkit';

await waitUntil(async () => ((await tryReadFile(p)) ?? '').includes('ready'), {
  describe: `content in ${p}`,
  timeoutMs: 10 * 60_000,
});
await waitUntil(async () => (await sh(`pidof nginx;...exit 64...`)).exitCode === 0, {
  describe: 'nginx active',
});
```

Probes: file presence via `getPathInfo`, content via `tryReadFile ?? ''`, ports via `bash` `/dev/tcp` or `sh` `nc -z -w 1`, processes via exact-name `pidof` (all with `|| exit 64` so absence is `exitCode`, not a throw). Default `retryOn` treats `ConnectorError` + `ExecError`/`ShellError` as "not yet"; pass `retryOn: () => false` for fail-fast.
