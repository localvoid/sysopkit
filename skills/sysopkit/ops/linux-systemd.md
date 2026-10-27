# Linux systemd: services, host identity, journal, networkd

All imports below come from the `@sysopkit/linux/systemd` barrel subpath.

## Services

```typescript
import { enableService, getServiceInfo, restartService, startService } from '@sysopkit/linux/systemd';

await enableService({ name: 'nginx', scope? }); // idempotent
await startService({ name: 'nginx', scope? });  // starts if inactive/failed, returns changed
await startService({ name: ['a.service', 'b.service'] }); // one systemctl call, returns boolean[]
await restartService({ name: 'nginx' });        // unconditional, requires loaded/merged unit
```

- `getServiceInfo({ name, scope? })` (`systemctl show --property=…`) returns `{ LoadState, ActiveState, SubState, UnitFileState, MainPID }`.
- `enableService`/`disableService` treat only `enabled` and `enabled-runtime` as enabled.
- `stopService` stops if active/failed; `reloadService` is unconditional like restart. `scope` selects `--user` vs system.
- Every service op accepts `name: string | readonly string[]`. Multi-unit calls batch into one `systemctl` invocation and emit one change per affected unit.
- After writing unit files, call `daemonReload()` before enabling or starting.

## Host identity

```typescript
import { setHostname, setLocale, setTimezone } from '@sysopkit/linux/systemd';

await setHostname({ name: 'web-1' }); // hostnamectl
await setTimezone({ name: 'UTC' }); // timedatectl
await setLocale({ name: 'LANG', value: 'en_US.UTF-8' }); // localectl
await setLocale({ locale: 'C.UTF-8' }); // bare form, sets LANG
```

## Journal

- `journalRead({ afterCursor?, lines? })` (`journalctl --show-cursor`); `journalVacuum({ size?, time?, files? })` (`journalctl --vacuum-*`).
- The rest are config serializers and paths: `JournaldConf`, `LOGIND_CONF_PATH`, `SLEEP_CONF_PATH`, `RESOLVED_CONF_PATH`, `TIMESYNCD_CONF_PATH`, `CoredumpConf`, `ZramGeneratorConf` (`ZRAM_GENERATOR_CONF_PATH` `/etc/systemd/zram-generator.conf`, `ZRAM_GENERATOR_DROP_IN_PATH`), and `SystemManagerConf` (`SYSTEM_CONF_PATH` `/etc/systemd/system.conf`, `USER_CONF_PATH` `/etc/systemd/user.conf`). Serialize with `serializeIni` from `sysopkit/op/ini`, write with `createFile` (prefer `*.conf.d/` drop-ins), then `daemonReload()` or restart the service.

## Unit and networkd types

- `ServiceUnitConf`, `TimerUnitConf` (plus `ServiceSectionOptions`, `TimerSectionOptions`, `UnitSectionOptions`, `InstallSectionOptions`) build unit files. Per-kind drop-ins (`ServiceUnitDropIn`, `MountUnitDropIn`, …) carry changed keys only and omit `[Install]`, which drop-ins ignore; they target `<unit>.d/*.conf`.
- `NetworkConf`/`NetDevConf`/`LinkConf` (plus `Network*`/`NetDev*`/`Link*` section types) cover systemd-networkd. `TmpFilesConf`/`SysusersConf` come with `parse*`/`serialize*`.
- `common.ts`: `SYSTEMD_SYSTEM_PATH`/`USER_PATH`, `SystemdScope`/`SystemdScopeOptions`, and `getSystemdConfigPath`/`getSystemdConfigDropInPath`/`getUnitPath`.

## Rules

- `restart`/`reload` are unconditional. Gate them behind `onChange` latches ([events-changes](../events-changes.md)), or they bounce services every run.
- `startService` emits a change and returns `true` when it starts; a no-op returns `false` without emitting. An array `name` returns `boolean[]` in input order. Gate downstream work on the return value instead of emitting again.
- Unit file writes need `daemonReload()` before systemd sees them. Without it, the unit changes but nothing happens.
