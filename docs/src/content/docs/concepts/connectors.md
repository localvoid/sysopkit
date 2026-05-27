---
title: Connectors
description: Transport layer for command execution — local, SSH, and Podman.
---

Connectors abstract how commands reach a target system. Every connector implements `connect()`, `spawn()`, and `[Symbol.asyncDispose]()`.

## Connector Interface

```ts
interface Connector extends AsyncDisposable {
  readonly host: string;
  readonly name: string;
  readonly vars: Record<string | symbol, any>;
  readonly rsh: string[]; // command prefix for remote execution
  connect(signal?: AbortSignal): Promise<void>;
  spawn(cmd: string[], signal?: AbortSignal): Process;
  [Symbol.asyncDispose](): Promise<void>;
}
```

The `Process` object returned by `spawn()` provides Web Streams for its input and output:

```ts
interface Process {
  stdin: WritableStream;
  stdout: ReadableStream;
  stderr: ReadableStream;
  exited: Promise<number>;
  kill(code?: number): void;
}
```

## LocalConnector

Runs commands directly on the local host.

```ts
import { LocalConnector } from 'sysopkit/connector/local';
import { start, apply } from 'sysopkit';

await start(async () => {
  await using c = new LocalConnector();

  await apply('example', c, async () => {
    await sh('echo hello');
  });
});
```

## SSHConnector

Connects to remote hosts via native OpenSSH with ControlMaster multiplexing for connection reuse. Supports password and key authentication.

```ts
import { SSHConnector } from 'sysopkit/connector/ssh';

await using c = new SSHConnector({
  host: '192.168.1.1',
  user: 'sysop',
  key: '/path/to/id_rsa',
  strictHostKeyChecking: false,
});
```

The SSH connector builds a ControlMaster socket for multiplexing, validates the connection on `connect()`, and cleans up the control socket on dispose.

## PodmanConnector

Executes commands inside running Podman containers via `podman exec`.

```ts
import { PodmanConnector } from 'sysopkit/connector/podman';

await using c = new PodmanConnector({ container: 'my-app' });
await c.connect(); // validates container is running
```

## Host Prefixes in Inventory

When using `resolveInventory()`, host strings with prefixes automatically select the right connector:

- `ssh:hostname` — SSH connector (default)
- `pod:container` — Podman connector

Custom connectors can be registered with custom prefixes.
