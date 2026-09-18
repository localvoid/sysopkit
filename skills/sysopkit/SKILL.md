---
name: sysopkit
description: TypeScript infrastructure automation (Ansible-like). Use when writing or debugging sysopkit playbooks, tasks, SSH/local/container connectors, sudo, inventory, apply(), core or Linux operations, change tracking, retry/timeout, or errors. Covers execution model, connectors, middleware, ops, events, and pitfalls.
---

# SysopKit

TypeScript-first infrastructure automation (programmatic Ansible alternative).
Zero runtime dependencies. Requires Bun (or Node 22+ with `AbortSignal.any`).

## Minimal workflow

```typescript
import { apply } from 'sysopkit';
import { start } from 'sysopkit/start';
import { resolveInventory } from 'sysopkit/inventory';
import { sudo } from 'sysopkit/middleware/sudo';
import { sh } from 'sysopkit/op/sh';

const result = await start(async () => {
  await using hosts = resolveInventory({ groups: {
    web: { hosts: { 'web-1': { host: '192.168.1.10', user: 'admin' } } },
  }});
  await apply('setup', hosts.getByGroup('web'), async () => {
    await sudo(async () => { await sh('apt-get install -y nginx'); });
  });
});
if (!result.success) throw result.error;
```

Rules that always apply:

- Everything runs inside `start()` — there is no ambient context outside it.
- Connectors are `AsyncDisposable` — always `await using` them (or the inventory).
- `start()` never throws; it returns `{ success, result | error, duration }`.
- `apply()` with one connector throws `ApplyError` on failure; with an array it
  returns per-host results and throws only past `maxFailPercent`.

## Router — read the page that matches the task

### Core

| Task | Read |
| --- | --- |
| Structuring runs: `start`, `task`, `utility`, context tree, dry-run, verbosity | [execution-model.md](execution-model.md) |
| Inventory definition, host selection, `apply()` batching and `ApplyError` | [inventory-apply.md](inventory-apply.md) |
| `emit` / `onChange` / `latch` / `emitChanged`, handler-driven workflows | [events-changes.md](events-changes.md) |
| `retry`, `timeout`, `sleep`, error classes, abort handling | [utilities-errors.md](utilities-errors.md) |

### Connectors

| Task | Read |
| --- | --- |
| SSH targets (default) — auth, ControlMaster, key perms, flattened `spawn` | [connectors/ssh.md](connectors/ssh.md) |
| Control-plane-local commands | [connectors/local.md](connectors/local.md) |
| `podman exec` targets — verbatim argv, no shell | [connectors/podman.md](connectors/podman.md) |

### Middleware

| Task | Read |
| --- | --- |
| `sudo` — privilege escalation, passwords, vars, `-n` behavior | [middleware/sudo.md](middleware/sudo.md) |
| `trace`, `expectStderrPrompt`, `TransformCmdMiddleware` | [middleware/others.md](middleware/others.md) |

### Operations

| Task | Read |
| --- | --- |
| `exec` / `sh` / `bash`, `$_` quoting, exit 64–78, `waitPort` / `waitProcess` | [ops/shell.md](ops/shell.md) |
| Files, dirs, links, `rsync`, `tar`, `curl` | [ops/files.md](ops/files.md) |
| Users, groups, mounts, network/probe helpers, sshd/ini/hosts serializers | [ops/system.md](ops/system.md) |
| Linux packages: apt, apk, dnf, pacman, rpm | [ops/linux-packages.md](ops/linux-packages.md) |
| Linux systemd: services, hostname/timezone, journal, networkd units | [ops/linux-systemd.md](ops/linux-systemd.md) |
| Linux config files (sysctl, sudoers, limits) and host facts (os, cpu, mem, disk) | [ops/linux-config.md](ops/linux-config.md) |
| OpenWrt UCI configs | `sysopkit-openwrt` skill |

## Watch out

- Outside `start()`, everything throws `No context available`.
  ([execution-model](execution-model.md))
- `sh`/`bash` throw on non-zero exit **except 64–78**; exit 64 means "not
  found". Probe via `exitCode`. Interpolate paths with `$_()`. ([ops/shell](ops/shell.md))
- Dry-run flag is **global** (set once, inherited); enforcement is **per-op**.
  `curl` ignores it entirely.
  ([execution-model](execution-model.md), [ops/files](ops/files.md))
- Multi-host `apply` below the failure threshold **returns** mixed results
  without throwing — check `r.success`. `connect()` failures abort the whole
  batch. ([inventory-apply](inventory-apply.md))
- SSH: `chmod 600` keys, `connect()` before first `rsh` read, prefer `exec`/`sh`
  ops over raw `spawn()`. ([connectors/ssh](connectors/ssh.md))
- Podman passes argv verbatim — use `sh` for shell syntax.
  ([connectors/podman](connectors/podman.md))
- `sudo` without a password uses `-n` (fails fast); `expectStderrPrompt`
  watches stderr only, fires once. ([middleware/sudo](middleware/sudo.md),
  [middleware/others](middleware/others.md))
- `onChange` dies with its scope; handlers must not throw.
  ([events-changes](events-changes.md))
- `rsync` defaults to `--delete`; `restartService` is unconditional — gate it
  behind `onChange`. ([ops/files](ops/files.md),
  [ops/linux-systemd](ops/linux-systemd.md))

## Repo map (import subpaths)

- `sysopkit/start`, `sysopkit` — entry point, context tree (`start`, `task`, `utility`, `emit`)
- `sysopkit/inventory`, `sysopkit` — orchestration (`resolveInventory`), host management (`apply`)
- `sysopkit/connector/local`, `sysopkit/connector/ssh`, `sysopkit/connector/podman` — transports
- `sysopkit/middleware/sudo`, `sysopkit/middleware/trace`, `sysopkit/middleware/expect`, `sysopkit/middleware/transform-cmd` — wrappers
- `sysopkit/op/exec`, `sysopkit/op/sh`, `sysopkit/op/bash`, `sysopkit/op/file`, `sysopkit/op/users`, `sysopkit/op/rsync`, `sysopkit/op/tar`,
  `sysopkit/op/curl`, `sysopkit/op/ini`, `sysopkit/op/mount`, `sysopkit/op/proc`, `sysopkit/op/net`, `sysopkit/op/netcat`, `sysopkit/op/ssh` — core ops
- `@sysopkit/linux/pkg/*`, `@sysopkit/linux/systemd`, `@sysopkit/linux/sysctl`, `@sysopkit/linux/sudoers`, `@sysopkit/linux/limits`,
  `@sysopkit/linux/os`, `@sysopkit/linux/disk`, `@sysopkit/linux/cpu`, `@sysopkit/linux/mem`, `@sysopkit/linux/kernel`, `@sysopkit/linux/tuned` — Linux ops
- OpenWrt UCI — see the `sysopkit-openwrt` skill
