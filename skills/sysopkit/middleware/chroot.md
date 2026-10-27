# chroot middleware

Confines every `spawn` in scope to a chroot directory by rewriting `cmd → ['chroot', root, ...cmd]`. It follows `TransformCmdMiddleware`: a new array, never a mutation of the input.

```typescript
import { chroot } from 'sysopkit/middleware/chroot';
import { createFile } from 'sysopkit/op/file';

await chroot('/target', async () => {
  // absolute paths resolve against the new root:
  await createFile({ path: '/etc/hostname', content: 'srv01\n' }); // → /target/etc/hostname
});
```

- Validation runs up front: an empty, relative, or `/` root throws `refusing: …` before spawning, so `chroot(bad, fn)` never runs `fn`.
- The middleware does **not** set up the chroot. Populate `<root>` and bind-mount `/dev`, `/proc`, `/sys` inside it first when confined commands (package scriptlets, `systemctl`, `dracut`) need them.
- `spawn`-based file ops (`createFile`, `sh`, `exec`) take chroot-relative paths in scope. Drop the `<root>` prefix, or it doubles.
