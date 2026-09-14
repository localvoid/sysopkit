---
title: sh
description: Run shell commands via `sh -c`.
---

```ts
import { sh, ShellError } from 'sysopkit/op/sh';
```

## sh()

Executes a command string via `sh -c`.

```ts
const result = await sh('hostname');
```

Throws `ShellError` on non-zero exit codes outside the 64-78 range.

```ts
const text = await sh('cat /etc/hostname');
```

## ShellError

```ts
class ShellError extends ExecError {
  cmd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  toString(): string; // formatted error with all fields
}
```

## `$_`

Quote a value for safe interpolation into a shell command:

```ts
import { sh, $_ } from 'sysopkit/op/sh';

const text = await sh(`cat ${$_(filePath)}`);
```
