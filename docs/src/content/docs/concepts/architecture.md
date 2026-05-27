---
title: Architecture
description: How SysopKit's subsystems connect — context propagation, connectors, middleware, operations.
---

SysopKit is a TypeScript infrastructure automation framework. Its architecture is built around a few core abstractions: contexts, connectors, middleware, operations and reporters.

## Core Design Principles

- **TypeScript first**: All configuration and logic is written in TypeScript, enabling compile-time validation, refactoring safety and IDE support.
- **Composable primitives**: Small, focused building blocks (connectors, middleware, operations) compose into complex workflows.
- **Context propagation**: `AsyncLocalStorage` carries execution state across async boundaries without explicit parameter passing.
- **Pluggable observability**: A pluggable reporting system captures all lifecycle events, changes, and errors.

## Execution Model

Every operation runs within an `ExecutionContext` propagated via `AsyncLocalStorage`. Contexts form a child-parent chain:

```text
root ⇐ connector ⇐ [middleware] ⇐ task / utility ⇐ …
```

Each context carries a reporter, connector, abort signal, typed variables, verbosity level, and dry-run flag. See [Execution Model](/concepts/execution-model/) for details.

## Connectors

The `Connector` interface abstracts command transport — local processes, SSH or podman containers. Every implementation provides `connect()`, `spawn()` methods. See [Connectors](/concepts/connectors/) for the guide.

## Middleware

`ConnectorMiddleware` wraps a connector using decorator pattern. Built-in middlewares add sudo, command tracing, prompt handling and command transformation. See [Middleware](/concepts/middleware/) for the guide.

## Apply Engine

`apply()` orchestrates operations across one or more hosts. Single-host mode connects and runs a function; multi-host mode processes hosts in parallel batches with configurable failure thresholds. See [Apply](/concepts/apply/) for the guide.

## Inventory System

The inventory system provides host management with typed variables, tags, and lazy connector creation. Variables merge with precedence: inventory → group → host. See [Inventory](/concepts/inventory/) for the guide.

## Events & Changes

Type-safe events use branded symbols. `CHANGE_EVENT` carries `ChangeEntry` objects describing infrastructure modifications. Events propagate up the context chain. See [Events & Changes](/concepts/events-and-changes/) for details.

## Reporter System

The `Reporter` interface captures all execution lifecycle events. The built-in `ConsoleReporter` provides:

- Hierarchical context display
- Color-coded output
- Duration
- Buffered output for parallel execution
- Formatting change reports
- Error stack formatting

Custom reporters can implement the `Reporter` interface to integrate with logging systems, CI pipelines or monitoring tools.
