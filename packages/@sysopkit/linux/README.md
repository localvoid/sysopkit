# @sysopkit/linux

Linux operations library for SysopKit.

## Installation

```bash
bun add @sysopkit/linux
```

## Modules

### System Information

#### `@sysopkit/linux/cpu`

CPU architecture and topology information.

```typescript
import { lscpu } from '@sysopkit/linux/cpu';

const info = await lscpu();
// { arch: 'x86_64', cores: 8, model: '...', vendor: '...', ... }
```

- `lscpu()` - Returns cpu info (arch, topology, vendor, model, sockets, cores/socket, threads/core)

#### `@sysopkit/linux/mem`

Memory information `/proc/meminfo`.

```typescript
import { getMemInfo } from '@sysopkit/linux/mem';

const mem = await getMemInfo();
// { total: 16777216000, available: 8388608000, used: 8388608000, free: 4194304000 }
```

- `getMemInfo()` - Returns memory info (total, available, used, free)

#### `@sysopkit/linux/disk`

Block device information.

```typescript
import { lsblk } from '@sysopkit/linux/disk';

const devices = await lsblk();
// [{ name: 'sda', size: 500107862016, type: 'disk', mountpoint: null, fstype: null, children: [...] }]
```

- `lsblk()` - Returns `BlockDeviceEntry[]` tree with name, size, type, mountpoint, fstype, and recursive children

#### `@sysopkit/linux/os`

OS identification `/etc/os-release`.

```typescript
import { getOSInfo } from '@sysopkit/linux/os';

const os = await getOsInfo();
// { id: 'arch', name: 'Arch Linux', versionId: '2024.02.01 }
```

- `getOSInfo()` - Returns OS information

### Package Management

#### `@sysopkit/linux/pkg/apt`

APT package management for Debian/Ubuntu.

```typescript
import { installPackages, removePackages, getInstalledPackages } from '@sysopkit/linux/pkg/apt';

await installPackages({ packages: ['nginx', 'curl'] });
await removePackages({ packages: ['vim'] });
const installed = await getInstalledPackages();
```

- `getInstalledPackages()` - Returns installed packages
- `installPackages({ packages, ... })` - **IDEMPOTENT** installs packages
- `removePackages({ packages, ... })` - **IDEMPOTENT** removes packages

#### `@sysopkit/linux/pkg/dnf`

DNF package management for Fedora/RHEL.

```typescript
import { installPackages, removePackages, getInstalledPackages } from '@sysopkit/linux/pkg/dnf';

await installPackages({ packages: ['nginx'], weakDependencies: false });
await removePackages({ packages: ['vim'] });
const installed = await getInstalledPackages();
```

- `getInstalledPackages()` - Returns installed packages
- `installPackages({ packages, weakDependencies?, ... })` - **IDEMPOTENT** installs packages
- `removePackages({ packages, ... })` - **IDEMPOTENT** removes packages

#### `@sysopkit/linux/pkg/rpm`

```typescript
import { importRpmKey, hasRpmKey, getRpmKeys, getRpmVars } from '@sysopkit/linux/pkg/rpm';

await importRpmKey({ key: 'https://example.com/RPM-GPG-KEY' });
const hasKey = await hasRpmKey('some-key-id');
const keys = await getRpmKeys();
const vars = await getRpmVars(['RPM_ARCH', 'RPM_OS']);
```

- `getRpmVars(vars)` - Evaluates RPM macros via `rpm -e`
- `getRpmKeys()` - Lists GPG keys in RPM database
- `hasRpmKey(key)` - Checks if a GPG key is installed
- `importRpmKey({ key, ... })` - Idempotent GPG key import

### Kernel

#### `@sysopkit/linux/kernel`

Kernel modules, kexec, and dmesg.

```typescript
import { lsmod, modinfo, dmesg, kexecLoad, kexecExec } from '@sysopkit/linux/kernel';

const modules = await lsmod();
const info = await modinfo('ext4');
const logs = await dmesg({ level: ['err', 'crit'] });
await kexecLoad({ kernel: '/boot/vmlinuz', initrd: '/boot/initrd.img', cmdline: '...' });
await kexecExec();
```

- `dmesg(options?)` - Returns messages from kernel ring buffer
- `lsmod()` - Returns loaded kernel modules
- `modinfo(module)` - Returns kernel module info (filename, license, description, depends, params)
- `kexecLoad({ kernel, initrd?, cmdline? })` - Loads kernel into memory
- `kexecExec()` - Reboots into loaded kernel

### System Configuration

#### `@sysopkit/linux/sysctl`

Sysctl configuration parsing and serialization.

```typescript
import {
  parseSysctlConf,
  serializeSysctlConf,
  SYSCTL_CONF_PATH,
  SYSCTL_DROP_IN_PATH,
} from '@sysopkit/linux/sysctl';

const conf = parseSysctlConf('net.ipv4.ip_forward = 1\n');
// { 'net.ipv4.ip_forward': '1' }

const text = serializeSysctlConf({ 'net.ipv4.ip_forward': '1' });
```

- `parseSysctlConf(content)` - Parses sysctl config
- `serializeSysctlConf(data)` - Serializes sysctl config

#### `@sysopkit/linux/limits`

Resource limits configuration (`/etc/security/limits.conf`).

```typescript
import { parseLimitsConf, serializeLimitsConf } from '@sysopkit/linux/limits';

const entries = parseLimitsConf('* soft nofile 65536\n');
const text = serializeLimitsConf(entries);
```

- `parseLimitsConf(content)` - Parses limits config
- `serializeLimitsConf(entries)` - Serializes limits config

#### `@sysopkit/linux/sudoers`

Sudoers configuration serialization.

```typescript
import {
  serializeSudoersConf,
  SUDOERS_CONF_PATH,
  SUDOERS_DROP_IN_PATH,
} from '@sysopkit/linux/sudoers';

const text = serializeSudoersConf([
  {
    user: 'deploy',
    hosts: ['ALL'],
    runas: 'ALL',
    commands: ['/usr/bin/systemctl restart app'],
    nopasswd: true,
  },
]);
// 'deploy ALL = (ALL) NOPASSWD: /usr/bin/systemctl restart app'
```

- `serializeSudoersConf(rules)` - Serializes sudoers config

### Systemd

#### `@sysopkit/linux/systemd`

```typescript
import {
  service,
  daemonReload,
  getServiceInfo,
  isServiceRunning,
  isServiceEnabled,
} from '@sysopkit/linux/systemd';

await service({ name: 'nginx', state: 'started', enabled: true });
await daemonReload();
const info = await getServiceInfo({ name: 'nginx' });
const running = await isServiceRunning({ name: 'nginx' });
const enabled = await isServiceEnabled({ name: 'nginx' });
```

**Service management:**

- `service({ name, state?, enabled?, scope? })` - **IDEMPOTENT** service control (start/stop/restart/reload/enable/disable)
- `getServiceInfo({ name, scope? })` - Returns `ServiceInfo` (loadState, activeState, subState, unitFileState, mainPid)
- `isServiceRunning({ name, scope? })` - Checks if service is active
- `isServiceEnabled({ name, scope? })` - Checks if service is enabled
- `daemonReload(options?)` - Runs `systemctl daemon-reload`

**System settings:**

- `setHostname({ hostname })` - **IDEMPOTENT** hostname via `hostnamectl`
- `setTimezone({ timezone })` - **IDEMPOTENT** timezone via `timedatectl`
- `setLocale({ key, value })` - **IDEMPOTENT** locale via `localectl`

**Journal:**

- `journalVacuum({ size?, time?, files? })` - Cleans old journal entries
- `journalRead({ afterCursor?, lines? })` - Reads journal entries with cursor support

**Configuration types:**

Type definitions for systemd configuration files:

| Module              | Config Path      | Type                               |
| ------------------- | ---------------- | ---------------------------------- |
| `systemd/journald`  | `journald.conf`  | `JournaldConf`                     |
| `systemd/coredump`  | `coredump.conf`  | `CoredumpConf`                     |
| `systemd/logind`    | `logind.conf`    | `LogindConf`                       |
| `systemd/resolved`  | `resolved.conf`  | `ResolvedConf`, `ResolvedLinkConf` |
| `systemd/sleep`     | `sleep.conf`     | `SleepConf`                        |
| `systemd/timesyncd` | `timesyncd.conf` | `TimesyncdConf`                    |

**Unit file types:**

Complete type definitions for all systemd unit file types:

- `ServiceUnitConf`
- `TimerUnitConf`
- `SocketUnitConf`
- `MountUnitConf`
- `PathUnitConf`
- `SliceUnitConf`
- `ScopeUnitConf`
- `AutomountUnitConf`
- `DeviceUnitConf`
- `TargetUnitConf`

**sysusers.d configs:**

- `parseSysUsersConf(content)`
- `serializeSysUsersConf(entries)`

**tmpfiles.d configs:**

- `parseTmpFilesConf(content)`
- `serializeTmpFilesConf(conf)`

**Networkd types:**

Type definitions for systemd-networkd configuration files.

### Tuned

#### `@sysopkit/linux/tuned`

Tuned profile management.

```typescript
import { setTuneProfile } from '@sysopkit/linux/tuned';

await setTuneProfile({ profile: 'throughput-performance' });
await setTuneProfile({ profile: null }); // disable
```

- `setTuneProfile({ profile })` - **IDEMPOTENT** profile switch (reads `/etc/tuned/active_profile`)

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))
