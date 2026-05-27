---
title: exec
description: Low-level process spawning and command execution.
---

```ts
import { spawn, exec } from 'sysopkit/op/exec';
```

## spawn()

Spawns a process via the current connector. Returns a `Process` object.

```ts
const proc = spawn(['ping', '-c', '3', '8.8.8.8']);
// proc.stdin, proc.stdout, proc.stderr, proc.exited
```

## exec()

Spawns a process and collects output into buffers.

```ts
const result = await exec(['ls', '-la']);
// { exitCode: number, stdout: string, stderr: string }
```

## Options

```ts
interface ExecOptions {
  stdin?: string | Uint8Array; // input to send to stdin
  stdout?: 'text' | 'buffer'; // output format (default: 'text')
  stderr?: 'text' | 'buffer'; // stderr format (default: 'text')
  signal?: AbortSignal; // cancellation signal
}
```
