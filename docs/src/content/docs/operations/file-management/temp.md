---
title: temp
description: Temporary files and directories with scoped cleanup.
---

```ts
import { withTempDir, withTempFile } from 'sysopkit/op/temp';
```

## withTempFile()

Creates a temp file via `mktemp`, runs a callback with its path, and removes the file afterwards — including when the callback throws. Pass `content` to pre-fill the file, or `template` to override the `mktemp` template.

```ts
await withTempFile(
  async (path) => {
    await sh(`virsh define ${$_(path)}`);
  },
  { content: xml, template: '/tmp/sysopkit-virsh-XXXXXXXX.xml' },
);
```

Use this for commands that must take a real file rather than stdin — stdin cannot be reopened by path on every transport, so `cmd /dev/stdin` fails where `cmd <file>` works.

## withTempDir()

Creates a temp directory via `mktemp -d`, runs a callback with its path, and removes the tree afterwards — including when the callback throws.

```ts
await withTempDir(async (dir) => {
  await writeFile(`${dir}/input.txt`, data);
  await sh(`process ${$_(dir)}/input.txt ${$_(dir)}/output.txt`);
  return readFile(`${dir}/output.txt`);
});
```

Both helpers are bare plumbing like `writeFile`: they do not check `dryRun` and emit no change events — gate on `ctx.dryRun` and report through your own task. Cleanup runs in `finally`, so it still needs a live connection; files orphaned by a mid-operation connection loss are reclaimed by `/tmp` aging.
