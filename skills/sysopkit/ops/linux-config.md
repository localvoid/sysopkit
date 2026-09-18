# Linux config files and host facts

```typescript
import { serializeSysctlConf } from '@sysopkit/linux/sysctl';
import { serializeSudoersConf } from '@sysopkit/linux/sudoers';
import { serializeLimitsConf } from '@sysopkit/linux/limits';
import { getOSInfo } from '@sysopkit/linux/os';
import { lsblk } from '@sysopkit/linux/disk';
import { lscpu } from '@sysopkit/linux/cpu';
import { getMemInfo } from '@sysopkit/linux/mem';
import { dmesg, lsmod } from '@sysopkit/linux/kernel';
import { setTuneProfile } from '@sysopkit/linux/tuned';
```

## Pattern: serialize → createFile → apply

Config modules are mostly pure `parse*` / `serialize*` plus a path constant.
The workflow is always: build the typed object, serialize, write idempotently,
reload the subsystem:

```typescript
import { serializeSysctlConf, SYSCTL_DROP_IN_PATH } from '@sysopkit/linux/sysctl';
import { createFile } from 'sysopkit/op/file';

await createFile({ path: `${SYSCTL_DROP_IN_PATH}/99-app.conf`, content: serializeSysctlConf(conf) });
```

## Config serializers

- `@sysopkit/linux/sysctl`: `SysctlConf` (`{ [key]: string }`), `parseSysctlConf` (skips
  `#`/`;`/blank, splits on `=`), `serializeSysctlConf` (`key = value` lines),
  `SYSCTL_CONF_PATH` (`/etc/sysctl.conf`), `SYSCTL_DROP_IN_PATH`
  (`/etc/sysctl.d`).
- `@sysopkit/linux/sudoers`: `SudoersConf` (`SudoersConfRule[]` with `user`, `hosts`,
  `runas?`, `commands`, `nopasswd?`), `serializeSudoersConf`
  (`user hosts = (runas) NOPASSWD: cmds`), `SUDOERS_CONF_PATH`,
  `SUDOERS_DROP_IN_PATH` (`/etc/sudoers.d`). Prefer drop-ins over editing
  `/etc/sudoers`.
- `@sysopkit/linux/limits`: `LimitsConf` (`LimitsEntry[]`: `domain`, `limitType`
  `soft|hard|-`, `item`, `value`), `parseLimitsConf` / `serializeLimitsConf`.

## Host facts (read-only)

- `@sysopkit/linux/os`: `getOSInfo()` → `{ name, version, id, versionId }` from
  `/etc/os-release` — branch package managers off this (see
  `linux-packages.md`).
- `@sysopkit/linux/disk`: `lsblk()` → `BlockDeviceEntry[]` (`lsblk --json -b`).
- `@sysopkit/linux/cpu`: `lscpu()` → `CpuInfo` (`lscpu --json`); `@sysopkit/linux/mem`: `getMemInfo()` →
  `MemInfo` (from `/proc/meminfo`).
- `@sysopkit/linux/kernel`: `dmesg(options?)`, `lsmod()` (via `/proc/modules`),
  `modinfo(module)`, `MODPROBE_D` (`/etc/modprobe.d`), `kexecLoad({ kernel,
  initrd?, cmdline? })` + `kexecExec()`.
- `@sysopkit/linux/tuned`: `setTuneProfile({ profile })` (`tuned-adm profile/off`),
  `_getActiveProfile()` (reads `/etc/tuned/active_profile`; underscore =
  internal helper, prefer `setTuneProfile`).

## Pitfalls

- Serializers do not validate (a bad sudoers rule is written faithfully) —
  validate high-risk files after writing (e.g. `visudo -c` via `sh`) before
  reporting success.
- `kexecExec()` reboots the target into the loaded kernel — never run it
  unconditionally in a playbook; gate behind an explicit flag.
