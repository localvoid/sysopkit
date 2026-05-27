---
title: sh
description: Shell command execution.
---

```ts
import { sh, ShellError } from 'sysopkit/op/sh';
```

## sh()

Executes a command string via `sh -c`:

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

Shell escaping:

```ts
const text = await sh(`cat ${$_(path)}`);
```
