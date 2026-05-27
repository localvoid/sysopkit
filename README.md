# SysopKit

A TypeScript infrastructure automation toolkit.

- Agentless — runs simple shell commands on target hosts
- Zero external NPM dependencies
- Idempotent operations with change detection
- Typed configs with structured data instead of string templates
- Native OpenSSH client with ControlMaster multiplexing
- Parallel multi-host execution
- Middlewares: privilege escalation (sudo), tracing, …

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Packages](#packages)
- [Operations](#operations)
- [Connectors](#connectors)
  - [SSH](#ssh)
  - [Local](#local)
  - [Podman](#podman)
- [Middleware](#middleware)
  - [SudoMiddleware](#sudomiddleware)
  - [TraceMiddleware](#tracemiddleware)
  - [ExpectMiddleware](#expectmiddleware)
- [Inventory](#inventory)
- [Apply](#apply)
- [Events](#events)
  - [Change Tracking](#change-tracking)
- [Utilities](#utilities)
- [Dry Run](#dry-run)
- [Verbosity](#verbosity)
- [Error Handling](#error-handling)
- [SysopKit vs Ansible](#sysopkit-vs-ansible)
- [License](#license)

## Installation

```sh
# pnpm
pnpm add sysopkit
# Bun
bun add sysopkit
```

## Quick Start

```typescript
import { apply, task } from 'sysopkit';
import { start } from 'sysopkit/start';
import { resolveInventory } from 'sysopkit/inventory';
import { sudo } from 'sysopkit/middleware/sudo';
import { createFile } from 'sysopkit/op/file';
import { sh } from 'sysopkit/op/sh';

const INVENTORY = {
  groups: {
    web: {
      hosts: {
        'web-1': { host: '192.168.1.10', user: 'admin' },
        'web-2': { host: '192.168.1.11', user: 'admin' },
      },
    },
    db: {
      hosts: {
        'db-1': { host: '192.168.1.20' },
      },
    },
  },
};

await start(async () => {
  await using hosts = resolveInventory(INVENTORY);

  await apply('setup nginx', hosts.getByGroup('web'), async () => {
    await sudo(async () => {
      await sh('apt install -y nginx');
      await createFile({
        path: '/etc/nginx/sites-available/default',
        content: 'server { listen 80; }',
        mode: 0o644,
        user: 'nginx',
        group: 'nginx',
      });
      await sh('systemctl enable --now nginx');
    });
  });
});
```

## Packages

| Package                | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `sysopkit`             | Core: context, connectors, middleware, basic ops, … |
| `@sysopkit/linux`      | Linux ops: apt, dnf, rpm, systemd, …                |
| `@sysopkit/cli`        | password prompts, selection menus, confirm dialogs  |
| `@sysopkit/test-utils` | Test Utils for ops                                  |

## Operations

Operations are the building blocks for infrastructure automation.

### Core Operations `sysopkit/op/*`

| Category   | Functions                                                   |
| ---------- | ----------------------------------------------------------- |
| **exec**   | `spawn`, `exec`                                             |
| **sh**     | `sh`                                                        |
| **bash**   | `bash`, `waitPort`                                          |
| **file**   | `createFile`, `deleteFile`, `readFile`, `writeFile`, …      |
| **users**  | `createUser`, `deleteUser`, `createGroup`, `deleteGroup`, … |
| **rsync**  | `rsyncPush`, `rsyncPull`                                    |
| **curl**   | `curl`                                                      |
| **ini**    | `serializeIni`                                              |
| **mount**  | `mount`, `parseFstab`, `serializeFstab`                     |
| **proc**   | `waitProcess`                                               |
| **net**    | `parseHosts`, `serializeHosts`                              |
| **netcat** | `waitPort`                                                  |
| **ssh**    | `serializeSshConf`                                          |

### Linux Operations `@sysopkit/linux/*`

| Category    | Functions                                                |
| ----------- | -------------------------------------------------------- |
| **pkg/apt** | `installPackages`, `removePackages`, …                   |
| **pkg/dnf** | `installPackages`, `removePackages`, …                   |
| **pkg/rpm** | `importKey`,                                             |
| **cpu**     | `lscpu`                                                  |
| **disk**    | `lsblk`                                                  |
| **kernel**  | `dmesg`, `lsmod`, `modinfo`, `kexecLoad`, `kexecExec`, … |
| **limits**  | `parseLimitsConf`, `serializeLimitsConf`                 |
| **mem**     | `getMemInfo`                                             |
| **os**      | `getOSInfo`                                              |
| **sudoers** | `serializeSudoersConf`                                   |
| **sysctl**  | `parseSysctlConf`, `serializeSysctlConf`                 |
| **systemd** | `service`, `daemonReload`, `setHostname`, …              |

## Connectors

### SSH

Uses native OpenSSH with ControlMaster multiplexing for connection reuse.

```typescript
import { SSHConnector } from 'sysopkit/connector/ssh';
import { start } from 'sysopkit/start';

await start(async () => {
  await using c = new SSHConnector({ host: '192.168.1.1', user: 'sysop' });

  await apply('example', c, async () => {
    await sh('echo hello');
  });
});
```

### Local

Runs commands directly on the local host.

```typescript
import { LocalConnector } from 'sysopkit/connector/local';
import { start } from 'sysopkit/start';

await start(async () => {
  await using c = new LocalConnector();

  await apply('example', c, async () => {
    await sh('echo hello');
  });
});
```

### Podman

Runs commands inside podman containers via `podman exec`.

```typescript
import { PodmanConnector } from 'sysopkit/connector/podman';
import { start } from 'sysopkit/start';

await start(async () => {
  await using c = new PodmanConnector({ container: 'my-app' });

  await apply('example', c, async () => {
    await sh('echo hello');
  });
});
```

## Middleware

Middleware wraps connectors using the decorator pattern.

### SudoMiddleware

Prepends `sudo` to commands.

```typescript
import { sudo } from 'sysopkit';

await sudo(() => sh('apt update'));
```

### TraceMiddleware

Pipes stdout/stderr through `TransformStream` and reports output via the reporter.

```typescript
import { trace } from 'sysopkit';

await trace(() => sh('apt install -y nginx'));
```

### ExpectMiddleware

Watches stderr for a pattern and writes a response to stdin. Useful for interactive prompts.

```typescript
import { expectStderrPrompt } from 'sysopkit';

await expectStderrPrompt(() => sh('ssh-keygen -f /root/.ssh/id_rsa'), {
  pattern: /passphrase/,
  response: '\n',
});
```

## Inventory

Define hosts and groups with variables. `resolveInventory()` resolves hosts, merges variables, and returns a `ResolvedInventory` that creates connections lazily:

```typescript
const INVENTORY = {
  vars: { env: 'production' },
  groups: {
    web: {
      vars: { role: 'webserver' },
      tags: ['frontend'],
      hosts: {
        'web-1': { vars: { id: 1 } },
        'web-2': { vars: { id: 2 } },
      },
    },
    db: {
      vars: { role: 'database' },
      hosts: {
        'db-1': {},
      },
    },
  },
};

await start(async () => {
  await using hosts = resolveInventory(INVENTORY);

  // Access resolved connectors
  hosts.getByGroup('web'); // connectors for web-1, web-2
  hosts.getByTag('frontend'); // connectors with frontend tag
  hosts.getByName('web-1'); // web-1 connector
  hosts.match('web-*'); // connectors matching glob pattern
  hosts.getAll(); // all connectors
});
```

Host prefixes determine connection type:

- `ssh:` for SSH (default)
- `pod:` for Podman containers.

Custom connector factories can be passed via the `connectors` option.

Variables inherit hierarchically: inventory → group → host.

## Apply

`apply()` orchestrates operations across hosts. Supports single-connector and multi-connector modes:

```typescript
// Single connector
await apply('name', connector, async () => {
  await sh('hostname');
});

// Multiple connectors with parallel batches
await apply(
  'name',
  hosts.getAll(),
  async () => {
    await sh('hostname');
  },
  { maxFailPercent: 20 },
);
```

Multi-connector mode processes hosts in parallel batches. The `maxFailPercent` option aborts remaining batches if the failure threshold is exceeded. On failure, throws `ApplyError` with all per-host results.

## Events

SysopKit uses a type-safe event system with branded symbols. Create custom events and register handlers with `on()`:

```typescript
import { on, emit, Event, task } from 'sysopkit';

const MY_EVENT: Event<string> = Symbol('my.event');

await task('demo', async (ctx) => {
  ctx.on(MY_EVENT, (data) => {
    console.log('received:', data);
  });

  await task('subtask', async () => {
    emit(MY_EVENT, 'hello');
  });
});
```

Events propagate up the context parent chain, calling registered handlers at each level.

### Change Tracking

Use `onChange()` to detect scoped changes:

```typescript
import { onChange, latch } from 'sysopkit';

const restart = latch();
await onChange(restart, async () => {
  await createFile({ path: '/etc/foo.conf', content: 'bar' });
});

if (restart()) {
  // restart foo service
}
```

## Utilities

### retry()

Configurable retry with fixed/exponential backoff. Skips on `AbortError`, optional `retryOn` predicate.

```typescript
import { retry } from 'sysopkit';

await retry(() => sh('curl -s http://api/health'), { attempts: 3, delay: 1000 });
```

### timeout()

Wraps a function with an `AbortController`-based timer. Throws `TimeoutError` on expiry.

```typescript
import { timeout } from 'sysopkit';

await timeout(() => sh('long-running-command'), { ms: 30_000 });
```

### sleep()

Abort-aware delay. Rejects with `signal.reason` on cancellation.

```typescript
import { sleep } from 'sysopkit';

await sleep(5000); // wait 5 seconds
```

## Dry Run

Set `SYSOPKIT_DRY_RUN=1` environment variable or pass `dryRun: true`:

```typescript
await start(
  async (ctx) => {
    // Idempotent operations will emit change events, but won't make any actual changes
    await createFile({ path, content });

    if (!ctx.dryRun) {
      await writeFile('path', 'content');
      await sh('script...');
    }
  },
  { dryRun: true },
);
```

## Verbosity

Set `SYSOPKIT_VERBOSITY` to `minimal`, `normal`, `debug`, or `trace`.

## Error Handling

SysopKit provides typed error classes:

| Error            | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `OperationError` | Operation-specific failures with context             |
| `ConnectorError` | Connection/transport failures                        |
| `AbortError`     | Execution was cancelled via `AbortSignal`            |
| `TimeoutError`   | Operation exceeded time limit                        |
| `ApplyError`     | Multi-host apply failures (extends `AggregateError`) |

Use `isAbortError()` to check for cancellation:

```typescript
import { isAbortError } from 'sysopkit';

try {
  await sh('some-command');
} catch (err) {
  if (isAbortError(err)) return; // gracefully handle cancellation
  throw err;
}
```

## SysopKit vs Ansible

SysopKit takes a fundamentally different approach than Ansible. Instead of a YAML-based DSL with its own control flow constructs, SysopKit leverages TypeScript as a full programming language. This eliminates the need for many Ansible-specific features.

**Loops and conditionals** are handled by standard TypeScript constructs. Where Ansible requires `loop:` directives and `when:` conditions, SysopKit uses `for` loops, `map()`, `filter()`, and `if/else` statements. This means you have the full expressiveness of a programming language rather than being limited to what the YAML DSL supports.

**Variable assignment** replaces Ansible's `register` directive. The result of any operation is simply returned as a value that you can store in a variable and use later. There's no special syntax—just normal TypeScript variables.

**Typed configs** replace string templates with structured data. Instead of generating config files through string interpolation, operations accept typed objects that are serialized correctly. For example, `parseResolvConf()` and `serializeResolvConf()` work with typed `ResolvConf` objects, `parseIni()` and `serializeIni()` handle `IniDocument` structures, and `parseSshdConfig()` returns typed configuration entries. This eliminates template syntax errors, provides IDE autocomplete for config keys, and catches type mismatches at compile time rather than at deployment.

**Templates** use TypeScript template literals or any templating library you prefer. Instead of Jinja2 templates in separate files, you can embed values directly in strings with `${variable}` syntax, or use libraries like Mustache, Handlebars, or EJS for more complex templating needs.

**Error handling** uses standard `try/catch/finally` blocks instead of Ansible's `block/rescue/always` construct. This gives you more fine-grained control over error handling and cleanup logic.

**Dynamic inventory** is just code. Instead of configuring plugins in YAML, you can fetch data from any API, parse JSON or YAML, transform it with TypeScript, and build your inventory programmatically. This works with any cloud provider, database, or custom source.

**Roles and reuse** work through npm packages and ES modules. Instead of Ansible's role directory structure, you can publish reusable automation as npm packages and import them with standard `import` statements. Version management comes from npm, and you can use any package in the TypeScript ecosystem.

**LSP and IDE support** leverages the full TypeScript tooling ecosystem. You get inline documentation from JSDoc comments, type-aware autocompletion, and refactoring tools out of the box. No need to install separate language servers or extensions — your editor already understands the code.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))
