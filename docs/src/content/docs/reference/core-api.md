---
title: Core API Reference
description: Detailed reference for SysopKit's core types and interfaces.
---

## Connector

```ts
interface Connector extends AsyncDisposable {
  readonly host: string;
  readonly name: string;
  readonly vars: Record<string | symbol, any>;
  readonly rsh: string[];
  connect(signal?: AbortSignal): Promise<void>;
  spawn(cmd: string[], signal?: AbortSignal): Process;
  [Symbol.asyncDispose](): Promise<void>;
}
```

Abstract command transport. Implementations: `LocalConnector`, `SSHConnector`, `PodmanConnector`.

## ConnectorBase

```ts
abstract class ConnectorBase implements Connector {
  host: string;
  name: string;
  vars: Record<string | symbol, any>;
  abstract get rsh(): string[];
  abstract spawn(cmd: string[], signal?: AbortSignal): Process;
  connect(signal?: AbortSignal): Promise<void>; // no-op by default
  [Symbol.asyncDispose](): Promise<void>; // no-op by default
}
```

Base class implementing common connector parts.

## ConnectorMiddleware

```ts
abstract class ConnectorMiddleware implements Connector {
  protected next: Connector;
  // All methods delegate to next by default
  // Subclasses override specific methods
}
```

Decorator pattern base class. Subclasses override methods to intercept or transform behavior.

## ExecutionContext

```ts
class ExecutionContext {
  type: ContextType; // 'root' | 'apply' | 'connector' | 'middleware' | 'utility' | 'task'
  parent?: ExecutionContext;
  reporter: Reporter;
  conn?: Connector;
  dryRun: boolean;
  name: string;
  details?: Record<string, any>;
  vars: Record<string | symbol, any>;
  signal: AbortSignal;
  verbosity: number;
  eventHandlers: Map<Event<any>, Set<EventHandler>>;
  tryGet<T>(key: Var<T>): T | undefined;
  get<T>(key: Var<T>): T;
  abort(reason?: any): never;
  on<T>(event: Event<T>, handler: (data: T) => void): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}
```

## Reporter

```ts
interface Reporter {
  ctxStart(ctx: ExecutionContext): void;
  ctxEnd(ctx: ExecutionContext): void;
  ctxError(ctx: ExecutionContext, error: unknown): void;
  onEvent(ctx: ExecutionContext, event: symbol, data: unknown): void;
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

Branded symbol type for type-safe events.

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

Branded symbol type for typed context variables.

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
