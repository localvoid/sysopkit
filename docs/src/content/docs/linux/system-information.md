---
title: System Information
description: CPU, memory, disk, and OS information operations.
---

```ts
import { lscpu } from '@sysopkit/linux/cpu';
import { getMemInfo } from '@sysopkit/linux/mem';
import { lsblk } from '@sysopkit/linux/disk';
import { getOSInfo } from '@sysopkit/linux/os';
```

## lscpu()

Retrieves CPU architecture and topology information using `lscpu --json`.

```ts
const cpu = await lscpu();
// { cores: 8, modelName: '...', architecture: 'x86_64',
//   vendor: 'GenuineIntel', sockets: 1, coresPerSocket: 8, threadsPerCore: 1 }
```

## getMemInfo()

Retrieves current memory usage statistics from `/proc/meminfo`.

```ts
const mem = await getMemInfo();
// { total: 16441499648, available: 8234586112, used: 8206913536, free: 481914880 }
```

## lsblk()

Retrieves block device information using `lsblk --json`.

```ts
const devices = await lsblk();
// returns BlockDeviceEntry[] with name, size, type, mountpoint, fstype, children
```

## getOSInfo()

Retrieves operating system identification by parsing `/etc/os-release`.

```ts
const os = await getOSInfo();
// { name: 'Ubuntu 24.04 LTS', version: '24.04 LTS (Noble Numbat)',
//   id: 'ubuntu', versionId: '24.04' }
```
