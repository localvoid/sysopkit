SysopKit is a project for system automation like Ansible. It uses TypeScript instead of YAML DSL for configuration.

## Architecture

### Execution Model

SysopKit uses `AsyncLocalStorage` to propagate an `ExecutionContext` tree across async boundaries. Every execution runs within a context that carries a `Reporter`, `Connector`, `AbortSignal`, typed `Vars`, verbosity level, and dry-run flag. Contexts form a parent chain: `root → connector → task/utility`. The `task()` and `utility()` functions create child contexts; `runWithContext()` enters the ALS scope and manages reporter lifecycle hooks.

### Connectors

The `Connector` interface abstracts command transport to a target system. It provides `connect()`, `spawn(cmd[], signal?)`, and `AsyncDisposable` cleanup. Implementations:

- **LocalConnector** – runs commands directly on the host
- **SSHConnector** – SSH with ControlMaster multiplexing, password/key auth, SSH_ASKPASS support
- **PodmanConnector** – `podman exec` into running containers, validates state on connect

### Middleware

`ConnectorMiddleware` wraps a connector using the decorator pattern. The `middleware()` function creates a new context with the wrapped connector. Built-in middlewares:

- **SudoMiddleware** – prepends `sudo`, supports user/role/env flags
- **TraceMiddleware** – pipes stdout/stderr through TransformStreams, reports output via reporter
- **ExpectPromptMiddleware** – watches stderr for a pattern, writes response to stdin
- **TransformCmdMiddleware** – transforms command arrays before execution

### Apply

`apply(name, connector|connectors[], fn)` orchestrates operations across hosts. Single-connector mode connects, creates a connector context, and runs `fn`. Multi-connector mode processes hosts in parallel batches (default 5), tracks failures, and aborts remaining batches if `maxFailPercent` threshold is exceeded. Throws `ApplyError` (extends `AggregateError`) with all per-host results on failure.

### Events & Changes

Type-safe events use branded symbols (`Event<T>`). The `CHANGE_EVENT` carries `ChangeEntry` objects (`type`, `resource`, `property`, `from`, `to`). `emit()` notifies the reporter and propagates up the parent chain calling registered handlers. `onChange(handler, fn)` registers a listener for the duration of `fn`.

### Utilities

- **retry()** – configurable retry with fixed/exponential backoff, skips on `AbortError`, optional `retryOn` predicate
- **timeout()** – wraps a function with an `AbortController`-based timer, throws `TimeoutError`
- **sleep()** – abort-aware delay that rejects with `signal.reason` on cancellation
- **Vars** – branded symbols (`Var<T>`) for typed context variables (e.g., `SSH_AUTH_SOCKET`, `SUDO_USER`)

### Operations

Operations are the building blocks for infrastructure automation. Each operation performs a specific system task (file management, package installation, user management).

## Project Structure

```
docs/ # Documentation (Astro+Starlight)
tests/ # Tests
packages/
 sysopkit/src/
    index.ts # Core exports
    inventory.ts # Inventory, ResolvedInventory, resolveInventory
    start.ts
    core/
      apply.ts
      connector.ts # Connector interface and base class
      context.ts # ExecutionContext, task, emit
      errors.ts
      events.ts # Event, ChangeEntry, CHANGE_EVENT
      middleware.ts # ConnectorMiddleware, middleware
      reporter.ts # Reporter base class
      retry.ts
      sleep.ts
      timeout.ts
      vars.ts
    connector/ # Connector implementations
      local.ts # LocalConnector
      podman.ts # PodmanConnector
      ssh.ts # SSHConnector
    middleware/ # Connector middlewares
      expect.ts # ExpectMiddleware
      sudo.ts # SudoMiddleware
      trace.ts # TraceMiddleware
      transform-cmd.ts # TransformCmdMiddleware
    op/ # Operations
    reporter/ # Reporter implementations
      console.ts # ConsoleReporter
    utils/
      constants.ts # ONCE, STREAM_TRUE, TEXT_ENCODER, TEXT_DECODER
      diff.ts # diff arrays
      handlers.ts # event handlers
      gpg.ts # GPG utilities
      process.ts # ExecOptions, ExecResult
      shell.ts # shMapExitCode, shAskPass, $_
      ssh.ts # SSH utilities
  @sysopkit/linux/
  @sysopkit/openwrt/
  @sysopkit/cli/
  @sysopkit/test-utils/
  package.json
```

## References

- Man Pages: https://man.archlinux.org/man/{MANUAL}.{SECTION}.en (check when unable to find a local man page)

## Tools

- TypeScript
  - Target: esnext
  - Module: nodenext
  - Strict mode
- Bun

## Commands

- `bun run check` - type check / lint
- `bun run test` - unit tests
- `bun run test -- "{test path}"` - filter by file
- `bun run test -- -t "{test name}"` - filter by name (supports regex)

## Instructions

- Do NOT run integration tests unless asked
- Do NOT run `tsc`, use `bun run check` for type-checking
- Keep docs and tests up-to-date
