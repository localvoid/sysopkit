# Linux systemd: services, manager, system, journal, networkd

```typescript
import { enableService, startService, restartService, getServiceInfo, daemonReload } from '@sysopkit/linux/systemd';
import { setHostname, setTimezone, setLocale } from '@sysopkit/linux/systemd';
import { journalRead, journalVacuum } from '@sysopkit/linux/systemd';
```

All imports above come from the `@sysopkit/linux/systemd` barrel subpath.

## Services

```typescript
import { getServiceInfo, enableService, startService, restartService } from '@sysopkit/linux/systemd';

await enableService({ name: 'nginx', scope? }); // idempotent
await startService({ name: 'nginx', scope? });  // starts if inactive/failed, returns changed
await restartService({ name: 'nginx' });        // unconditional, requires loaded/merged unit
```

- `getServiceInfo({ name, scope? })` (`systemctl show --property=…`) returns
  `{ LoadState, ActiveState, SubState, UnitFileState, MainPID }`.
- Only `enabled` / `enabled-runtime` count as enabled for `enableService` /
  `disableService` idempotency.
- `stopService` stops if active/failed; `reloadService` is unconditional like
  restart. `scope` selects `--user` vs system.
- After writing unit files, call `daemonReload()` before enabling/starting.

## Host identity

```typescript
import { setHostname, setTimezone, setLocale } from '@sysopkit/linux/systemd';

await setHostname({ name: 'web-1' });   // hostnamectl
await setTimezone({ name: 'UTC' });     // timedatectl
await setLocale({ name: 'LANG', value: 'en_US.UTF-8' }); // localectl
await setLocale({ locale: 'C.UTF-8' }); // bare form, sets LANG
```

## Journal

- `journalRead({ afterCursor?, lines? })` (`journalctl --show-cursor`),
  `journalVacuum({ size?, time?, files? })` (`journalctl --vacuum-*`).
- The rest are config-file serializers + paths (`JournaldConf`,
  `LOGIND_CONF_PATH`, `SLEEP_CONF_PATH`, `RESOLVED_CONF_PATH`,
  `TIMESYNCD_CONF_PATH`, `CoredumpConf`) — serialize, write with `createFile`,
  then `daemonReload()` / restart the relevant service.

## Unit and networkd types

- `ServiceUnitConf`, `TimerUnitConf` (+ `ServiceSectionOptions`,
  `TimerSectionOptions`, `UnitSectionOptions`, `InstallSectionOptions`) for
  building unit files; `Network*` / `NetDev*` / `Link*` types for
  systemd-networkd; `TmpFilesConf` / `SysusersConf` with `parse*`/`serialize*`.
- `common.ts`: `SYSTEMD_SYSTEM_PATH` / `USER_PATH`, `SystemdScope` /
  `ScopeOptions`, `getSystemdConfigPath` / `getSystemdConfigDropInPath` /
  `getUnitPath` path helpers.

## Pitfalls

- `restart`/`reload` are unconditional — gate them behind `onChange` latches
  (see `events-changes.md`) or they bounce services on every run.
- `startService` emits a change when it starts and returns `true`; on no-op it
  returns `false` without emitting. Gate downstream work on the return value —
  do not `emitChanged` again for the same start.
- Unit file writes need `daemonReload()` before systemd sees them; forgetting
  it is the classic "changed the unit but nothing happened" bug.
