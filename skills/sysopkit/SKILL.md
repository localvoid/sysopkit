---
name: sysopkit
description: 'SysopKit (TypeScript, Ansible-like) playbooks: write, run, and debug them — frames and tasks, inventory and apply() over SSH/Podman or local connectors, sudo/chroot middleware, file/package/systemd ops, change events, retry/timeout, dry-run.'
---

# SysopKit

TypeScript infrastructure automation. Runs on Bun, or Node 22+ with `AbortSignal.any`. No runtime dependencies.

## Converge

A playbook is done when it **converges**: the second run emits no changes, restarts nothing, and reports every host successful. Ops that must act every run are explicit and gated. That test decides the design.

```typescript
import { apply } from 'sysopkit';
import { resolveInventory } from 'sysopkit/inventory';
import { sudo } from 'sysopkit/middleware/sudo';
import { sh } from 'sysopkit/op/sh';
import { main } from 'sysopkit/start';

await main(async () => {
  await using hosts = resolveInventory({
    groups: {
      web: { hosts: { 'web-1': { host: '192.168.1.10', options: { user: 'admin' } } } },
    },
  });
  await apply(
    'setup',
    hosts.getByGroup('web'),
    async () => {
      await sudo(async () => {
        await sh('apt-get install -y nginx');
      });
    },
    { maxFailPercent: 0 },
  ); // any host failure fails the run
});
```

## Five rules

1. **Stay in a frame.** `main()` (CLI) or `start()` (library) opens the root context; `task`, `utility`, `middleware`, and `apply` open child frames. Outside one, every helper throws `No context available`. `start()` never throws — it returns `{ success, result | error, duration }`; `main()` adds `process.exitCode = 1` and rethrows at debug verbosity.
2. **Dispose what you open.** Inventory and connectors are `AsyncDisposable`; use `await using`. A leaked SSH connector leaves its control socket and tempdir behind.
3. **Report through `ctx`.** Take the callback parameter (`start`/`task`/`utility`/`apply` all pass it); fall back to `context()` only in helpers that cannot take it. `console.*` bypasses buffering, hierarchy prefixes, verbosity, the TUI footer, and custom reporters.
4. **Gate what always acts.** `restartService`, `reloadService`, `cp`, `tar`, `curl`, and `touchFile` run on every pass. Gate restarts on a change (`onChange` + `latch`); gate the rest on an explicit flag.
5. **Check every host.** Multi-host `apply` below `maxFailPercent` returns mixed results without throwing: inspect `r.success`. `connect()` failures abort the whole batch.

## Route by task

### Core

| Task | Read |
| --- | --- |
| Frames: `start`/`main`, `task`/`utility`/`middleware`, context tree, dry-run, verbosity, reporting | [execution-model.md](execution-model.md) |
| Inventory: `type`/`options`, var merge, host selection; `apply()` batching and `ApplyError` | [inventory-apply.md](inventory-apply.md) |
| Changes: `emit`, `onChange` scope, `latch`, `emitChanged`, reporter output | [events-changes.md](events-changes.md) |
| `retry`, `timeout`, `sleep`, `waitForReady`, `waitUntil`, abort and error classes | [utilities-errors.md](utilities-errors.md) |

### Connectors

| Task | Read |
| --- | --- |
| SSH (default): auth, ControlMaster, key perms (`chmod 600`), `spawn` joins argv into one shell string | [connectors/ssh.md](connectors/ssh.md) |
| Control-plane local: raw `spawn`, no shell, process contract | [connectors/local.md](connectors/local.md) |
| Podman (`type: pod`): verbatim argv — use `sh`; `rsync` unavailable | [connectors/podman.md](connectors/podman.md) |

### Middleware

| Task | Read |
| --- | --- |
| `sudo`: stderr-only prompt, `-n` without a password, vars | [middleware/sudo.md](middleware/sudo.md) |
| `trace`, `expectStderrPrompt`, `TransformCmdMiddleware` | [middleware/others.md](middleware/others.md) |
| `chroot`: confines argv only — set up the root and mounts yourself | [middleware/chroot.md](middleware/chroot.md) |

### Operations

| Task | Read |
| --- | --- |
| `exec`/`sh`/`bash` (throw except exit 64–78; quote with `$_`), `which`, probe patterns | [ops/shell.md](ops/shell.md) |
| Files, links, `rsync` (adds `--delete`), `tar`, `curl` (path mode skips in dry-run), temp staging (`/dev/stdin` fails on sockets) | [ops/files.md](ops/files.md) |
| Users, mounts, hosts/sshd/ini serializers | [ops/system.md](ops/system.md) |
| Linux packages: apt, apk, dnf, pacman, rpm | [ops/linux-packages.md](ops/linux-packages.md) |
| Linux systemd: services, hostname/timezone, journal, networkd units | [ops/linux-systemd.md](ops/linux-systemd.md) |
| Linux configs (sysctl, sudoers, limits, iwd, fwupd) and host facts (os, cpu, mem, disk, kernel, tuned) | [ops/linux-config.md](ops/linux-config.md) |
| OpenWrt UCI configs | `sysopkit-openwrt` skill |
| Libvirt domains, networks, storage (Bun-only) | `sysopkit-libvirt` skill |

## Imports

- `sysopkit` — `apply`, `emit`, `task`, `utility`, `waitUntil`, `waitForReady`, `retry`, `timeout`
- `sysopkit/start` — `main`, `start`
- `sysopkit/inventory` — `resolveInventory`
- `sysopkit/connector/{local,ssh,podman}` — transports
- `sysopkit/middleware/{sudo,trace,expect,transform-cmd,chroot}` — wrappers
- `sysopkit/op/{exec,sh,bash,file,temp,users,rsync,tar,curl,ini,mount,net,ssh,which}` — core ops
- `@sysopkit/linux/pkg/*`, `@sysopkit/linux/{systemd,sysctl,sudoers,limits,os,disk,cpu,mem,kernel,tuned,fwupd,iwd}` — Linux ops
- `@sysopkit/libvirt/{domain,network,storage}` — see the `sysopkit-libvirt` skill
- `@sysopkit/openwrt/uci/*` — see the `sysopkit-openwrt` skill
