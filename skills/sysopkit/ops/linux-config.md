# Linux config files and host facts

Config modules are mostly pure `parse*`/`serialize*` functions plus path constants. The workflow is always: build the typed object, serialize, write idempotently, reload the subsystem.

```typescript
import { SYSCTL_DROP_IN_PATH, serializeSysctlConf } from '@sysopkit/linux/sysctl';
import { createFile } from 'sysopkit/op/file';

await createFile({
  path: `${SYSCTL_DROP_IN_PATH}/99-app.conf`,
  content: serializeSysctlConf(conf),
});
```

## Serializers

- `@sysopkit/linux/sysctl`: `SysctlConf` (`{ [key]: string }`), `parseSysctlConf` (skips `#`/`;`/blank, splits on `=`), `serializeSysctlConf` (`key = value` lines), `SYSCTL_CONF_PATH` (`/etc/sysctl.conf`), `SYSCTL_DROP_IN_PATH` (`/etc/sysctl.d`).
- `@sysopkit/linux/sudoers`: `SudoersConf` (`SudoersConfRule[]` with `user`, `hosts`, `runas?`, `commands`, `nopasswd?`), `serializeSudoersConf` (`user hosts = (runas) NOPASSWD: cmds`), `SUDOERS_CONF_PATH`, `SUDOERS_DROP_IN_PATH` (`/etc/sudoers.d`). Prefer drop-ins over editing `/etc/sudoers`.
- `@sysopkit/linux/limits`: `LimitsConf` (`LimitsEntry[]`: `domain`, `limitType` `soft|hard|-`, `item`, `value`), `parseLimitsConf`/`serializeLimitsConf`.
- `@sysopkit/linux/fwupd`: `FwupdConf` (`{ fwupd: {...} }`, the `[fwupd]` section of `fwupd.conf`), `FWUPD_CONF_PATH` (`/etc/fwupd/fwupd.conf`). Booleans are `'true'|'false'` string literals for `serializeIni` compatibility; lists are single delimiter-joined strings (`;`/`,`); `ReleasePriority?: 'local'|'remote'` (omit for empty/no adjustment). Serialize with `serializeIni`, write with `createFile`.
- `@sysopkit/linux/iwd`: `IwdMainConf` (optional `General`/`Network`/`Blacklist`/`Rank`/`Scan`/`IPv4`/`DriverQuirks` sections of `main.conf`), `IwdPskConf` (`Settings`/`Security` with full EAP settings/`Network`/`IPv4`/`IPv6` for `.psk`, shared groups with `.open`/`.8021x`), `IWD_MAIN_CONF_PATH` (`/etc/iwd/main.conf`), `IWD_NETWORK_DIR` (`/var/lib/iwd`), `getIwdNetworkPath(ssid, security)` (verbatim name if only `[A-Za-z0-9 _-]`, else `=` plus lowercase hex) and `encodeIwdSsid(ssid)`. Same `'true'|'false'` convention as fwupd. Append `[@pem@<name>]` embedded PEMs manually; `serializeIni` cannot emit them, so reference them via `embed:<name>`.

## Host facts (read-only)

- `@sysopkit/linux/os`: `getOSInfo()` → `{ name, version, id, versionId }` from `/etc/os-release`. Branch package managers on it ([linux-packages](linux-packages.md)).
- `@sysopkit/linux/disk`: `lsblk()` → `BlockDeviceEntry[]` (`lsblk --json -b`).
- `@sysopkit/linux/cpu`: `lscpu()` → `CpuInfo` (`lscpu --json`). `@sysopkit/linux/mem`: `getMemInfo()` → `MemInfo` (from `/proc/meminfo`).
- `@sysopkit/linux/kernel`: `dmesg(options?)`, `lsmod()` (via `/proc/modules`), `modinfo(module)`, `MODPROBE_D` (`/etc/modprobe.d`), `kexecLoad({ kernel, initrd?, cmdline?, syscall? })` (`syscall: 'file'` for locked-down Secure Boot), and `kexecExec({ detach?, delaySec?, skipLoadedCheck? }?)` (detached by default: backgrounds the jump and returns on handoff; verify out-of-band).
- `@sysopkit/linux/tuned`: `setTuneProfile({ profile })` (`tuned-adm profile/off`); `_getActiveProfile()` reads `/etc/tuned/active_profile` (underscore = internal, prefer `setTuneProfile`).

## Rules

- Serializers do not validate; a bad sudoers rule is written faithfully. Validate high-risk files after writing (`visudo -c` via `sh`) before reporting success.
- `kexecExec()` reboots the target into the loaded kernel. Run it only behind an explicit flag, and verify success out-of-band (e.g. `/proc/cmdline`) because it detaches.
