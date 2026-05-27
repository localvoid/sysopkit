---
title: systemd
description: Systemd service, journal, daemon-reload, and system settings operations.
---

Operations for managing systemd services, journal, daemon configuration, and system-level settings like hostname, timezone, and locale.

```ts
import {
  getServiceInfo,
  enableService,
  disableService,
  startService,
  stopService,
  restartService,
  reloadService,
  daemonReload,
  journalRead,
  journalVacuum,
  setHostname,
  setTimezone,
  setLocale,
  getUnitPath,
  getSystemdConfigPath,
  getSystemdConfigDropInPath,
} from '@sysopkit/linux/systemd';
```

## Service Options

Most service operations accept `ServiceOptions` with the following fields:

```ts
{ name: string; scope?: 'system' | 'user'; user?: string }
```

- `scope` — Defaults to `"system"`. Use `"user"` for user-scoped units.
- `user` — Username for user-scope (determines home directory paths).

## getServiceInfo()

Retrieves service state information from `systemctl show`.

```ts
const info = await getServiceInfo({ name: 'nginx.service' });
// { LoadState: 'loaded', ActiveState: 'active', SubState: 'running',
//   UnitFileState: 'enabled', MainPid: 1234 }
```

## enableService()

> **IDEMPOTENT**

Enables a service to start at boot. Skips if already enabled.

```ts
await enableService({ name: 'nginx.service' });
```

## disableService()

> **IDEMPOTENT**

Disables a service from starting at boot. Skips if already disabled.

```ts
await disableService({ name: 'nginx.service' });
```

## startService()

> **IDEMPOTENT**

Starts a service. Returns `true` if the service was started, `false` if already running.

```ts
await startService({ name: 'nginx.service' });
```

## stopService()

> **IDEMPOTENT**

Stops a running service. No-op if already stopped.

```ts
await stopService({ name: 'nginx.service' });
```

## restartService()

Restarts a running service. No-op if the service is not active.

```ts
await restartService({ name: 'nginx.service' });
```

## reloadService()

Reloads a running service's configuration. No-op if not active.

```ts
await reloadService({ name: 'nginx.service' });
```

## daemonReload()

Reloads systemd manager configuration. Required after creating, modifying, or deleting unit files.

```ts
await daemonReload();
await daemonReload({ scope: 'user' });
```

## journalRead()

Reads journal entries. Supports cursor-based incremental reading.

```ts
const output = await journalRead({ afterCursor: '...', lines: 50 });
```

## journalVacuum()

Cleans up old journal entries by size, time, or file count.

```ts
await journalVacuum({ size: '500M', time: '7d' });
```

## setHostname()

> **IDEMPOTENT**

Sets the system hostname using `hostnamectl set-hostname`. No-op if already set to the desired value.

```ts
await setHostname({ name: 'web-01' });
```

## setTimezone()

> **IDEMPOTENT**

Sets the system timezone using `timedatectl set-timezone`. No-op if already set.

```ts
await setTimezone({ name: 'America/New_York' });
```

## setLocale()

> **IDEMPOTENT**

Sets a locale variable using `localectl set-locale`.

```ts
await setLocale({ name: 'LANG', value: 'en_US.UTF-8' });
```

## Utility Functions

### getUnitPath(name, options?)

Returns the absolute path to a systemd unit file.

```ts
const path = getUnitPath('nginx.service');
// '/etc/systemd/system/nginx.service'

const userPath = getUnitPath('foo.service', { scope: 'user', user: 'alice' });
// '/home/alice/.config/systemd/user/foo.service'
```

### getSystemdConfigPath(configName, options?)

Returns the absolute path to a systemd daemon configuration file.

```ts
const path = getSystemdConfigPath('journald.conf');
// '/etc/systemd/journald.conf'
```

### getSystemdConfigDropInPath(configName, dropInName)

Returns the absolute path to a drop-in configuration file.

```ts
const path = getSystemdConfigDropInPath('journald.conf', 'sysops');
// '/etc/systemd/journald.conf.d/sysops.conf'
```

## Configuration Types

The systemd module also exports TypeScript types for configuration files. See the following pages for details:

- [journald](./journald) — `journald.conf(5)` types
- [logind](./logind) — `logind.conf(5)` types
- [resolved](./resolved) — `resolved.conf(5)` types
- [timesyncd](./timesyncd) — `timesyncd.conf(5)` types
- [sleep](./sleep) — `sleep.conf(5)` types
- [coredump](./coredump) — `coredump.conf(5)` types
- [sysusers](./sysusers) — `sysusers.d(5)` parsing/serialization
- [tmpfiles](./tmpfiles) — `tmpfiles.d(5)` parsing/serialization
- [networkd](./networkd) — systemd-networkd `.link`/`.network`/`.netdev` types
