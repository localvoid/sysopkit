# SysopKit Architecture

SysopKit is a TypeScript-based system automation framework, designed as a programmatic alternative to YAML-driven tools like Ansible. It provides a type-safe, composable API for infrastructure automation across local hosts, remote SSH targets, and containerized environments.

## Core Design Principles

- **TypeScript-first**: All configuration and logic is written in TypeScript, enabling compile-time validation, refactoring safety, and IDE support.
- **Composable primitives**: Small, focused building blocks (connectors, middleware, operations) compose into complex workflows.
- **Context propagation**: `AsyncLocalStorage` carries execution state across async boundaries without explicit parameter passing.
- **Reporter-driven observability**: A pluggable reporting system captures all lifecycle events, changes, and errors.

## Execution Model

### AsyncLocalStorage Context Tree

Every operation runs within an `ExecutionContext` propagated via Node.js `AsyncLocalStorage`. This eliminates the need to thread state through function arguments and ensures that nested async calls always have access to the correct context.

Context types form a parent chain:

```
root ⇐ connector ⇐ [middleware] ⇐ task / utility ⇐ …
```

Each context inherits from its parent:

- **Reporter**: Shared across the tree for unified output
- **Connector**: The transport layer for command execution
- **AbortSignal**: Composed with parent signals for cascading cancellation
- **Vars**: Typed context variables with parent-chain lookup
- **Dry-run flag**: Propagated to all child contexts

### Context Lifecycle

1. `start()` creates a root context and enters the ALS scope via `runWithContext()`
2. `apply()` creates connector contexts for each target host
3. `task()` and `utility()` create child contexts for named operations
4. `middleware()` wraps the connector and creates a middleware context
5. Each context calls `reporter.ctxStart()` on entry and `reporter.ctxEnd()` on exit
6. On error, `reporter.ctxError()` is called and the AbortController is triggered

### Task vs Utility

- **Task**: User-facing operation with normal verbosity, optional `details` metadata, and configurable verbosity level
- **Utility**: Internal helper with debug-level verbosity, used for retries, timeouts, and event listeners

## Connectors

The `Connector` interface abstracts command transport to a target system. Every connector implements:

- `connect(signal?)`: Establish the transport connection
- `spawn(cmd[], signal?)`: Execute a command and return a `Process` handle
- `[Symbol.asyncDispose]()`: Clean up resources

### Implementations

- `LocalConnector` - Direct process spawn
- `SSHConnector` - SSH with ControlMaster
- `PodmanConnector` - `podman exec`

## Middleware

`ConnectorMiddleware` wraps connectors using the decorator pattern. The `middleware()` function creates a new context with the wrapped connector and runs the provided function within it.

### Built-in Middlewares

- `SudoMiddleware` - Prepends `sudo` to commands, caches password validation (60s window), supports user/role/env flags, SELinux roles
- `TraceMiddleware` - Pipes stdout/stderr through `TransformStream`s, reports output via reporter on stream flush
- `ExpectPromptMiddleware` - Watches stderr for a pattern (string/RegExp), writes response to stdin, proxies subsequent stdin writes
- `TransformCmdMiddleware` - Transforms command arrays before execution

Middleware stacks compose naturally: `sudo()` → `trace()` → connector, each layer wrapping the next.

## Apply Engine

`apply()` orchestrates operations across one or more hosts.

### Single-Host Mode

```typescript
await apply('name', connector, async (ctx) => {
  // ctx has connector attached
});
```

Connects to the host, creates a connector context, runs the function, and returns the result or throws `ApplyError`.

### Multi-Host Mode

```typescript
const results = await apply(
  'name',
  connectors,
  async (ctx) => {
    // ctx has one connector per invocation
  },
  { batchSize: 5, maxFailPercent: 20 },
);
```

- Processes hosts in parallel batches (default size: 5)
- Tracks failure count across batches
- Aborts remaining batches if `maxFailPercent` threshold is exceeded
- Returns `ApplyResult<T>[]` (union of success/failure)
- Throws `ApplyError` (extends `AggregateError`) containing all per-host results on threshold breach

## Events & Changes

Type-safe events use branded symbols to prevent accidental collisions:

```typescript
export type Event<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.event';
};
```

### Change Events

The `CHANGE_EVENT` carries `ChangeEntry` objects describing infrastructure modifications:

```typescript
interface ChangeEntry {
  type: string; // e.g., "file", "user", "package"
  resource: string; // e.g., "/etc/nginx/nginx.conf"
  property?: string; // e.g., "mode", "content"
  from?: string; // previous value
  to?: string; // new value
}
```

Operations emit changes via `emitChanged()`. The reporter renders these as human-readable diffs.

### Event Propagation

`emit()` notifies the reporter and propagates up the parent chain, calling registered handlers at each level. `on()` registers handlers on the current context. `onChange(handler, fn)` registers a change listener for the duration of `fn`.

## Inventory System

The inventory system provides Ansible-like host management with lazy connection creation.

### Structure

```typescript
interface Inventory {
  vars?: Record<symbol | string, any>; // Global variables
  groups: Record<string, GroupConfig>; // Named host groups
}

interface GroupConfig {
  vars?: Record<symbol | string, any>; // Group-level variables
  tags?: string[]; // Group-level tags
  hosts: Record<string, HostConfig>; // Host definitions
}
```

### Variable Merging

Variables merge with increasing precedence: inventory → group → host. Connector factories resolve host strings with prefix detection (`ssh:`, `pod:`) to select the appropriate connector type.

### ResolvedInventory

`resolveInventory()` returns a `ResolvedInventory` that:

- Resolves all hosts with merged variables and tags
- Creates connectors lazily on first access
- Caches connectors for reuse
- Implements `AsyncDisposable` for bulk cleanup via `await using`

### Host Selection

| Method             | Description                                  |
| ------------------ | -------------------------------------------- |
| `getByGroup(name)` | All hosts in a named group                   |
| `getByTag(tags)`   | Union of hosts matching any tag              |
| `getByName(name)`  | Single host by name                          |
| `getAll()`         | All hosts                                    |
| `match(pattern)`   | Glob pattern matching (e.g., `web-*`, `db?`) |

## Reporter System

The `Reporter` interface captures all execution lifecycle events:

```typescript
interface Reporter {
  ctxStart(ctx): void;
  ctxEnd(ctx): void;
  ctxError(ctx, error): void;
  spawn(ctx, cmd): void;
  onEvent(ctx, event, data): void;
  retryAttempt(ctx, attempt, delay, error): void;
  info(ctx, message): void;
  warn(ctx, message): void;
  error(ctx, message): void;
}
```

### ConsoleReporter

The default reporter provides:

- Hierarchical context display with `›` separators (e.g., `root › web1 › sudo › install nginx`)
- Color-coded output (green ✓, red ✗, yellow ↻) when attached to a TTY
- Duration formatting per context
- Buffered output with pause/resume for parallel execution ordering
- Change entry rendering with before/after diffs
- Error stack formatting with context hierarchy and command output

### Verbosity Levels

| Level | Constant            | Usage                         |
| ----- | ------------------- | ----------------------------- |
| 0     | `VERBOSITY_MINIMAL` | Suppress most output          |
| 1     | `VERBOSITY_NORMAL`  | Default task visibility       |
| 2     | `VERBOSITY_TRACE`   | Include trace-level details   |
| 3     | `VERBOSITY_DEBUG`   | Full debug output (utilities) |

## Utility Functions

| Function | Purpose |
| --- | --- |
| `retry(options, fn)` | Configurable retry with fixed/exponential backoff, `retryOn` predicate, abort-aware |
| `timeout(ms, fn)` | Wraps function with `AbortController`-based timer, throws `TimeoutError` |
| `sleep(ms)` | Abort-aware delay; rejects with `signal.reason` on cancellation |

## Context Variables (Vars)

Vars are branded symbols providing typed, scope-safe context variables:

```typescript
export type Var<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.var';
};
```

Variables are looked up via parent-chain traversal with `tryGet()` (returns `undefined`) or `get()` (throws). Built-in vars include `SSH_AUTH_SOCKET`, `SUDO_USER`, `SUDO_PASSWORD`, `SUDO_ROLE`, `SUDO_PRESERVE_ENV`.

## Error Hierarchy

| Error            | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `ConnectorError` | Transport-level errors (carries connector reference)                      |
| `OperationError` | Operation-specific failures (with cause chain)                            |
| `AbortError`     | Cancellation signal                                                       |
| `TimeoutError`   | Timeout exceeded                                                          |
| `ApplyError`     | Multi-host apply failures (extends `AggregateError`, carries all results) |
| `ExecError`      | Command execution failures (carries cmd, exitCode, stdout, stderr)        |

## Entry Point

`start(fn, options)` is the top-level entry point for automation workflows:

1. Creates a root context with reporter, dry-run flag, vars, and abort signal
2. Reads `SYSOPKIT_VERBOSITY` and `SYSOPKIT_DRY_RUN` environment variables
3. Executes the function within the `AsyncLocalStorage` scope to store context
4. Returns `StartResult` with success/error status and duration

## Operations

Operations are the building blocks for infrastructure automation, located in `src/op/`. Each operation performs a specific system task and emits change events when state is modified.

## Typical Workflow

```typescript
await start(async () => {
  await using hosts = resolveInventory({
    vars: { [SUDO_PASSWORD]: 'secret' },
    groups: {
      web: { hosts: { web1: { host: '10.0.1.1' }, web2: { host: '10.0.1.2' } } },
      db: { hosts: { db1: { host: 'pod:postgres' } } },
    },
  });

  await apply('nginx', hosts.getByGroup('web'), async () => {
    await sudo(async () => {
      await task('install', async () => {
        await sh('apt install -y nginx');
        emitChanged({ type: 'package', resource: 'nginx', to: 'installed' });
      });
    });
  });
});
```
