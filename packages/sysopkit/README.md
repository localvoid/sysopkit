# sysopkit

Core of [SysopKit](https://www.sysopkit.com): execution context, `apply()`, connectors, middleware, inventory, typed events, and base operations. Zero external runtime dependencies.

Full docs: <https://www.sysopkit.com>

## Requirements

- [Bun](https://bun.sh) (or Node 22+ with `AbortSignal.any`)
- OpenSSH client for `SSHConnector`; `rsync` for `rsyncPush`/`rsyncPull`; `podman` for `PodmanConnector`

## Installation

```sh
bun add sysopkit
# pnpm add sysopkit
# npm install sysopkit
```

## Quick Start

```typescript
import { apply } from 'sysopkit';
import { start } from 'sysopkit/start';
import { resolveInventory } from 'sysopkit/inventory';
import { sudo } from 'sysopkit/middleware/sudo';
import { sh } from 'sysopkit/op/sh';
import { createFile } from 'sysopkit/op/file';

const result = await start(async () => {
  await using hosts = resolveInventory({
    groups: {
      web: {
        hosts: {
          'web-1': { host: '192.168.1.10', user: 'admin' },
        },
      },
    },
  });

  await apply('setup nginx', hosts.getByGroup('web'), async () => {
    await sudo(async () => {
      await sh('apt-get install -y nginx');
      await createFile({
        path: '/etc/nginx/sites-available/default',
        content: 'server { listen 80; }',
      });
    });
  });
});

if (!result.success) throw result.error;
```

`start()` creates the root context, runs `fn`, and returns `{ success, result | error, duration }`. It never throws — check `result.success` yourself.

## Operations

Idempotent where marked. Non-idempotent helpers (`sh`, `exec`, `curl`, …) run every time.

| Module | Import | Highlights |
| --- | --- | --- |
| `exec` | `sysopkit/op/exec` | `spawn(cmd, signal?)`, `exec(cmd, opts?)` |
| `sh` | `sysopkit/op/sh` | `sh(script, opts?)` via `sh -c` |
| `bash` | `sysopkit/op/bash` | `bash(script, opts?)`, `waitPort({ host, port, … })` |
| `file` | `sysopkit/op/file` | **Idempotent** `createFile`, `createDir`, `createLink`; `readFile`, `writeFile`, `deleteFile`, `deleteDir`, `touchFile`, `sha256`, `waitFilePath`, `waitFileContent` |
| `users` | `sysopkit/op/users` | **Idempotent** `createUser`, `deleteUser`, `createGroup`, `deleteGroup`; `getCurrentUser`, `parsePasswdFile`, `parseGroupFile` |
| `rsync` | `sysopkit/op/rsync` | `rsyncPush(options)`, `rsyncPull(options)` |
| `curl` | `sysopkit/op/curl` | `curl({ url, … })` |
| `tar` | `sysopkit/op/tar` | `tar({ src, dst })`, `untar({ src, dst })` |
| `ini` | `sysopkit/op/ini` | `serializeIni(data)` (typed sections) |
| `mount` | `sysopkit/op/mount` | `mount({ src, path, … })`, `umount({ path })`, `mountInfo({ path })`, `parseFstab`, `serializeFstab` |
| `proc` | `sysopkit/op/proc` | `waitProcess({ pid, … })` |
| `net` | `sysopkit/op/net` | `parseHosts`, `serializeHosts` (`/etc/hosts`) |
| `netcat` | `sysopkit/op/netcat` | `waitPort({ host, port, … })` |
| `ssh` | `sysopkit/op/ssh` | `serializeSshConf(config)` (`sshd_config`) |
| `gpg` | `sysopkit/utils/gpg` | `parseGpgKey`, `showGpgKeys` |

## Connectors

```typescript
import { LocalConnector } from 'sysopkit/connector/local';
import { SSHConnector } from 'sysopkit/connector/ssh';
import { PodmanConnector } from 'sysopkit/connector/podman';
import { apply } from 'sysopkit';
import { start } from 'sysopkit/start';

await start(async () => {
  // SSH with ControlMaster multiplexing
  await using ssh = new SSHConnector({ host: '192.168.1.1', user: 'sysop' });
  await apply('example', ssh, async () => {
    /* ops here */
  });

  await using local = new LocalConnector();
  await using pod = new PodmanConnector({ container: 'my-app' });
});
```

Connectors implement `connect(signal?)`, `spawn(cmd[], signal?)`, and `AsyncDisposable` — always use `await using`.

## Middleware

Middleware wraps the current connector for the scope of `fn`:

```typescript
import { sudo } from 'sysopkit/middleware/sudo';
import { trace } from 'sysopkit/middleware/trace';
import { expectStderrPrompt } from 'sysopkit/middleware/expect';

await sudo(
  async () => {
    /* every spawn is prefixed with sudo */
  },
  { user: 'root' },
);

await trace(async () => {
  /* stdout/stderr streamed to the reporter */
});

await expectStderrPrompt(
  async () => {
    /* answer interactive prompts */
  },
  { pattern: /passphrase/, response: '\n' },
);
```

- `sudo(fn, options?)` — honors `SUDO_USER`, `SUDO_PASSWORD`, `SUDO_PRESERVE_ENV`, `SUDO_ROLE` vars.
- `trace(fn, options?)` — `TransformStream` piping with reporter output.
- `expectStderrPrompt(fn, { pattern, response })` — watches stderr, writes to stdin.
- `TransformCmdMiddleware` (`sysopkit/middleware/transform-cmd`) — rewrite `cmd[]` before spawn.

## Inventory and Apply

```typescript
import { resolveInventory } from 'sysopkit/inventory';

await using hosts = resolveInventory(INVENTORY, {
  // optional custom factories, keyed by host prefix
  connectors: { 'k8s:': (host, h) => new MyConnector(host) },
});

hosts.getByGroup('web');
hosts.getByTag('frontend');
hosts.getByName('web-1');
hosts.match('web-*');
hosts.getAll();
```

Host prefixes select the connector: `ssh:` (default) and `pod:`. Variables merge with precedence inventory → group → host.

```typescript
// Single host — returns { success, conn, result }, throws ApplyError on failure
await apply('name', connector, async (ctx) => {});

// Many hosts — parallel batches, returns ApplyResult[]; throws ApplyError past threshold
await apply('name', hosts.getAll(), async (ctx) => {}, { batchSize: 5, maxFailPercent: 20 });
```

## Events and Change Tracking

```typescript
import { onChange, latch, emitChanged } from 'sysopkit';
import { task } from 'sysopkit';

const restart = latch();
await onChange(restart, async () => {
  await task('configure', async () => {
    // idempotent ops call emitChanged() internally when they modify state
    emitChanged({ type: 'file', resource: '/etc/foo.conf', to: 'updated' });
  });
});

if (restart()) {
  // restart the service
}
```

`emit(event, data)` propagates up the context parent chain; `onChange(handler, fn)` subscribes to `CHANGE_EVENT` for the duration of `fn`.

## Utilities

```typescript
import { retry } from 'sysopkit';
import { timeout } from 'sysopkit';
import { sleep } from 'sysopkit';

await retry({ attempts: 3, delay: 1000, backoff: 'exponential' }, () =>
  sh('curl -sf http://api/health'),
);
await timeout(30_000, () => sh('long-running-command')); // throws TimeoutError
await sleep(5000); // abort-aware; rejects with signal.reason on cancellation
```

`retry` skips `AbortError` and accepts a `retryOn(err)` predicate.

## Dry Run, Verbosity, Errors

```typescript
// Dry run: SYSOPKIT_DRY_RUN=1 or start(fn, { dryRun: true })
// Idempotent ops emit change events but change nothing; guard the rest:
import { context } from 'sysopkit';
if (!context().dryRun) {
  /* non-idempotent work */
}
```

Verbosity via `SYSOPKIT_VERBOSITY`: `minimal` (0), `normal` (1, default), `trace` (2), `debug` (3, includes utilities).

| Error            | Meaning                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `OperationError` | Op failure with cause chain                                              |
| `ConnectorError` | Transport failure (carries connector)                                    |
| `ExecError`      | Non-zero exit (carries `cmd`, `exitCode`, `stdout`, `stderr`)            |
| `AbortError`     | Cancelled via `AbortSignal` — check with `isAbortError(err)`             |
| `TimeoutError`   | `timeout()` exceeded                                                     |
| `ApplyError`     | Multi-host failure; extends `AggregateError`, carries per-host `results` |

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](../../LICENSE-APACHE))
- MIT license ([LICENSE-MIT](../../LICENSE-MIT))
