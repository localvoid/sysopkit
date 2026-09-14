# @sysopkit/linux

Linux operations for [SysopKit](https://www.sysopkit.com). Requires `sysopkit` as a peer dependency — every function runs inside the current execution context (connector + reporter).

## Installation

```sh
bun add @sysopkit/linux sysopkit
# pnpm add @sysopkit/linux sysopkit
# npm install @sysopkit/linux sysopkit
```

## Modules

| Module | Import | Highlights |
| --- | --- | --- |
| `cpu` | `@sysopkit/linux/cpu` | `lscpu()` — arch, topology, vendor/model |
| `mem` | `@sysopkit/linux/mem` | `getMemInfo()` — total/available/used/free from `/proc/meminfo` |
| `disk` | `@sysopkit/linux/disk` | `lsblk()` — `BlockDeviceEntry[]` tree |
| `os` | `@sysopkit/linux/os` | `getOSInfo()` — `/etc/os-release` |
| `pkg/apt` | `@sysopkit/linux/pkg/apt` | **Idempotent** `installPackages`, `removePackages` (`autoremove?`); `getInstalledPackages()` |
| `pkg/apk` | `@sysopkit/linux/pkg/apk` | **Idempotent** `installPackages`, `removePackages` (dry-run via `--simulate`); `getInstalledPackages()` |
| `pkg/dnf4` | `@sysopkit/linux/pkg/dnf4` | **Idempotent** `installPackages` (`weakDependencies?`), `removePackages` (unused deps cleaned natively); `getInstalledPackages()` |
| `pkg/dnf5` | `@sysopkit/linux/pkg/dnf5` | **Idempotent** `installPackages` (`weakDependencies?`), `removePackages` (unused deps cleaned natively); `getInstalledPackages()` |
| `pkg/rpm` | `@sysopkit/linux/pkg/rpm` | **Idempotent** `importRpmKey({ name, content })`; `hasRpmKey(key)`, `getRpmKeys()`, `getRpmVars(vars)` |
| `pkg/pacman` | `@sysopkit/linux/pkg/pacman` | **Idempotent** `installPackages`, `removePackages` (`autoremove?`, dry-run previews); `getInstalledPackages()` |
| `kernel` | `@sysopkit/linux/kernel` | `lsmod()`, `modinfo(module)`, `dmesg(opts?)`, `kexecLoad({ kernel, initrd?, cmdline? })`, `kexecExec()` |
| `sysctl` | `@sysopkit/linux/sysctl` | `parseSysctlConf`, `serializeSysctlConf` |
| `limits` | `@sysopkit/linux/limits` | `parseLimitsConf`, `serializeLimitsConf` (`/etc/security/limits.conf`) |
| `sudoers` | `@sysopkit/linux/sudoers` | `serializeSudoersConf(rules)` |
| `systemd` | `@sysopkit/linux/systemd` | **Idempotent** `service`, `setHostname`, `setTimezone`, `setLocale`; `daemonReload`, `getServiceInfo`, `isServiceRunning`, `isServiceEnabled`, `journalRead`, `journalVacuum`; unit-file, `sysusers.d`/`tmpfiles.d`, and `networkd` types |
| `tuned` | `@sysopkit/linux/tuned` | **Idempotent** `setTuneProfile({ profile })` (`null` disables) |

## Usage

```typescript
import { installPackages } from '@sysopkit/linux/pkg/apt';
import { service } from '@sysopkit/linux/systemd';
import { getOSInfo } from '@sysopkit/linux/os';
import { serializeSudoersConf } from '@sysopkit/linux/sudoers';

await installPackages({ packages: ['nginx', 'curl'] });

await service({ name: 'nginx', state: 'started', enabled: true });

const os = await getOSInfo();
// { id: 'debian', name: 'Debian GNU/Linux', versionId: '13', … }

const text = serializeSudoersConf([
  {
    user: 'deploy',
    hosts: ['ALL'],
    runas: 'ALL',
    commands: ['/usr/bin/systemctl restart app'],
    nopasswd: true,
  },
]);
```

Systemd config-file types (`journald`, `coredump`, `logind`, `resolved`, `sleep`, `timesyncd`), unit-file types (`ServiceUnitConf`, `TimerUnitConf`, `SocketUnitConf`, `MountUnitConf`, …), and `sysusers.d`/`tmpfiles.d` `parse`/`serialize` helpers live under `@sysopkit/linux/systemd`.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](../../../LICENSE-APACHE))
- MIT license ([LICENSE-MIT](../../../LICENSE-MIT))
