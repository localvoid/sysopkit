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

On systems with locked-down Secure Boot, `KEXEC_LOAD` is blocked and `KEXEC_FILE_LOAD` (`kexec -s`) is required so the kernel signature is verified:

```ts
await kexecLoad({
  kernel: '/boot/vmlinuz-linux',
  initrd: '/boot/initramfs-linux.img',
  cmdline: 'root=/dev/sda1 ro quiet',
  syscall: 'file',
});
```

`syscall` selects the kexec interface: `'file'` (`-s`, file only), `'load'` (`-c`, classic `KEXEC_LOAD` only), `'auto'` (`-a`, try file first with fallback). Omit for the kexec default (auto).

## kexecExec()

Executes the loaded kernel, rebooting the system immediately.

```ts
await kexecExec();
```

Detached mode is the default: the exec is remote-backgrounded with stdin/stdout/stderr detached (so the calling SSH session can close first) after a `delaySec` handoff delay (default `3`), and the call returns on handoff. The jump severs the transport by design, so success is unobservable — verify via out-of-band state (e.g. wait for the new kernel's `/proc/cmdline`), never via this call's result.

```ts
// Jump and return on handoff (defaults: detach: true, delaySec: 3).
await kexecExec();

// Foreground kexec -e: the transport dies with the jump, so success
// surfaces as a transport error, indistinguishable from genuine failure.
await kexecExec({ detach: false });
```

`kexecExec()` fails fast with "no kernel loaded" unless `/sys/kernel/kexec_loaded` reads `1` (i.e. `kexecLoad()` ran first); pass `skipLoadedCheck: true` to bypass the check.
