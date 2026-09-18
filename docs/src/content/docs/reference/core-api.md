---
title: Core API Reference
description: Detailed reference for SysopKit's core types and interfaces.
---

## Connector

```ts
interface Connector extends AsyncDisposable {
  readonly host: string;
  readonly name: string;
  readonly vars: Record<string | symbol, any> | undefined;
  readonly rsh: string[];
  connect(signal?: AbortSignal): Promise<void>;
  spawn(cmd: string[], signal?: AbortSignal): Promise<Process>;
  [Symbol.asyncDispose](): Promise<void>;
}
```

Abstract command transport with `LocalConnector`, `SSHConnector`, and `PodmanConnector` implementations.

## ConnectorBase

```ts
abstract class ConnectorBase implements Connector {
  readonly host: string;
  readonly name: string;
  readonly vars: Record<string | symbol, any> | undefined;
  abstract get rsh(): string[];
  abstract spawn(cmd: string[], signal?: AbortSignal): Promise<Process>;
  connect(signal?: AbortSignal): Promise<void>; // no-op by default
  [Symbol.asyncDispose](): Promise<void>; // no-op by default
}
```

Base class that implements the shared connector behavior.

## ConnectorMiddleware

```ts
abstract class ConnectorMiddleware implements Connector {
  protected next: Connector;
  // All methods delegate to next by default
  // Subclasses override specific methods
}
```

Base class for the decorator pattern. Subclasses override methods to intercept or transform behavior.

## ExecutionContext

```ts
class ExecutionContext {
  type: ContextType; // 'root' | 'apply' | 'connector' | 'middleware' | 'utility' | 'task'
  parent: ExecutionContext | null;
  reporter: Reporter;
  conn: Connector | null;
  dryRun: boolean;
  name: string;
  details: string | (() => string | Record<string, string | number | undefined>) | undefined;
  vars: Record<string | symbol, any> | undefined;
  signal: AbortSignal;
  verbosity: Verbosity;
  eventHandlers: null | Map<Event<any>, Array<(data: unknown) => void>>;
  tryGet<T>(key: Var<T> | string): T | undefined;
  get<T>(key: Var<T> | string): T;
  abort(reason?: string): never;
  on<T>(event: Event<T>, handler: (data: T) => void): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
```

## Reporter

```ts
interface Reporter {
  ctxStart(ctx: ExecutionContext): void;
  ctxEnd(ctx: ExecutionContext): void;
  ctxError(ctx: ExecutionContext, error: unknown): void;
  onEvent<T>(ctx: ExecutionContext, event: Event<T>, data: T): void;
  spawn(ctx: ExecutionContext, cmd: string[]): void;
  retryAttempt(ctx: ExecutionContext, attempt: number, delay: number, error: unknown): void;
  info(ctx: ExecutionContext, message: string): void;
  warn(ctx: ExecutionContext, message: string): void;
  error(ctx: ExecutionContext, message: string): void;
}
```

## Event

```ts
type Event<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.event';
};
```

A branded symbol type for type-safe events.

## ChangeEntry

```ts
interface ChangeEntry {
  type: string; // resource type (e.g., "file", "user", "package")
  resource: string; // resource path or identifier
  property?: string; // modified property
  from?: string; // previous value (omitted on create)
  to?: string; // new value (omitted on delete)
}
```

## Var

```ts
type Var<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.var';
};
```

A branded symbol type for typed context variables.

## Process

```ts
interface Process {
  stdin: WritableStream;
  stdout: ReadableStream;
  stderr: ReadableStream;
  exited: Promise<number>;
  kill(code?: number): void;
}
```
