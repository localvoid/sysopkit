---
title: Kernel
description: Kernel module management, ring buffer, and kexec operations.
---

```ts
import { dmesg, lsmod, modinfo, kexecLoad, kexecExec } from '@sysopkit/linux/kernel';
```

## dmesg()

Retrieves kernel ring buffer messages. Parses JSON output when available.

```ts
const entries = await dmesg({ level: 'err', since: '1 hour ago' });
// entries: DmesgEntry[] with facility, level, timestamp, message
```

## lsmod()

Lists currently loaded kernel modules by parsing `/proc/modules`.

```ts
const modules = await lsmod();
// [{ module: 'ext4', size: 131072, usedBy: ['/'], count: 1 }, ...]
```

## modinfo()

Retrieves detailed information about a kernel module using `modinfo`.

```ts
const info = await modinfo('ext4');
// { filename: '/lib/modules/.../ext4.ko', license: 'GPL',
//   description: 'Fourth Extended Filesystem', ... }
```

## kexecLoad()

Loads a kernel into memory using `kexec -l`. The kernel is loaded but not executed.

```ts
await kexecLoad({
  kernel: '/boot/vmlinuz-linux',
  initrd: '/boot/initramfs-linux.img',
  cmdline: 'root=/dev/sda1 ro quiet',
});
```

## kexecExec()

Executes the loaded kernel, rebooting the system immediately using `kexec -e`.

```ts
await kexecExec();
```
