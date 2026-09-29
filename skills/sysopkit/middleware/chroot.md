# chroot middleware

```typescript
import { chroot, ChrootMiddleware } from 'sysopkit/middleware/chroot';
```

Confines every `spawn` in scope to a chroot directory — prefix rewrite `cmd → ['chroot', root, ...cmd]`, following `TransformCmdMiddleware` (new array, never mutates input).

```typescript
import { chroot } from 'sysopkit/middleware/chroot';
import { createFile } from 'sysopkit/op/file';

await chroot('/target', async () => {
  // absolute paths resolve against the new root:
  await createFile({ path: '/etc/hostname', content: 'srv01\n' }); // → /target/etc/hostname
});
```

- Validation up front: empty, relative, or `/` roots throw `refusing: …` before spawning (so `chroot(bad, fn)` never runs `fn`).
- The middleware does **not** set up the chroot: populate `<root>` and bind-mount `/dev`, `/proc`, `/sys` inside it beforehand when confined commands (package scriptlets, `systemctl`, `dracut`) need them.
- File ops that go through `spawn` (`createFile`, `sh`, `exec`) take chroot-relative paths in scope — drop the `<root>` prefix, otherwise it doubles.
