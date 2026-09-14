---
title: Error Classes
description: Complete reference of all SysopKit error types.
---

## Error Hierarchy

```
Error
├── ConnectorError
├── OperationError
├── AbortError
├── TimeoutError
├── ExecError
└── AggregateError
    └── ApplyError
```

---

## ConnectorError

Reports transport-level failures such as refused connections or authentication errors.

```ts
import { ConnectorError } from 'sysopkit';

class ConnectorError extends Error {
  name: 'ConnectorError';
  constructor(message: string, conn: Connector);
}
```

| Property | Type        | Description               |
| -------- | ----------- | ------------------------- |
| `conn`   | `Connector` | The connector that failed |

---

## OperationError

Wraps the underlying cause of an operation failure.

```ts
import { OperationError } from 'sysopkit';

class OperationError extends Error {
  name: 'OperationError';
  constructor(message: string, cause?: Error);
}
```

| Property | Type                 | Description          |
| -------- | -------------------- | -------------------- |
| `cause`  | `Error \| undefined` | The underlying error |

---

## AbortError

Reports execution cancelled via `AbortSignal`. Use `isAbortError()` to check safely across realm boundaries.

```ts
import { AbortError, isAbortError } from 'sysopkit';

class AbortError extends Error {
  name: 'AbortError';
  constructor(message?: string); // default: 'Aborted'
}

function isAbortError(err: unknown): boolean;
```

---

## TimeoutError

Reports an operation that exceeded the time limit set by `timeout()`.

```ts
import { TimeoutError } from 'sysopkit';

class TimeoutError extends Error {
  name: 'TimeoutError';
  constructor(message?: string);
}
```

---

## ExecError

Reports a command execution failure, carrying the command, exit code, and full output.

```ts
import { ExecError } from 'sysopkit';

class ExecError extends Error {
  name: 'ExecError';
  constructor(message: string, cmd: string[], exitCode: number, stdout: string, stderr: string);
}
```

| Property   | Type       | Description             |
| ---------- | ---------- | ----------------------- |
| `cmd`      | `string[]` | The command that failed |
| `exitCode` | `number`   | Process exit code       |
| `stdout`   | `string`   | Full stdout output      |
| `stderr`   | `string`   | Full stderr output      |

---

## ApplyError

Reports multi-host apply failures and extends `AggregateError` with per-host results.

```ts
import { ApplyError } from 'sysopkit';

class ApplyError<R = unknown> extends AggregateError {
  name: 'ApplyError';
  constructor(errors: unknown[], message: string, results: ApplyResult<R>[]);
}
```

| Property  | Type               | Description                      |
| --------- | ------------------ | -------------------------------- |
| `results` | `ApplyResult<R>[]` | Per-host success/failure results |

```ts
type ApplyResult<T> = ApplySuccess<T> | ApplyFailure;

interface ApplySuccess<T> {
  success: true;
  conn: Connector;
  result: T;
}

interface ApplyFailure {
  success: false;
  conn: Connector;
  error: unknown;
}
```

---

## ShellError

The error thrown by `sh()` and `bash()` operations for non-zero exit codes outside the 64-78 BSD usage-error range.

```ts
import { ShellError } from 'sysopkit/op/sh';

class ShellError extends ExecError {
  // inherits cmd, exitCode, stdout, stderr from ExecError
}
```
