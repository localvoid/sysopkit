---
title: Inventory
description: Define hosts and groups with typed variables.
---

SysopKit's inventory system manages hosts and groups with typed variables.

## Structure

```ts
interface Inventory {
  vars?: Record<symbol | string, any>; // Global variables
  groups: Record<string, GroupConfig>; // Named host groups
}

interface GroupConfig {
  vars?: Record<symbol | string, any>; // Group-level variables
  tags?: string[]; // Group-level tags
  hosts: Record<string, HostConfig>; // Host definitions
}

interface HostConfig {
  // Built-ins: SshHostConfig | PodHostConfig. Custom types extend
  // BaseHostConfig and combine into your own union (see below).
  host?: string; // Plain address (default: host name)
  type?: string; // Connector type (default 'ssh')
  options?: Record<string, any>; // Per-type options, into the connector constructor
  vars?: Record<symbol | string, any>;
  tags?: string[];
}
```

## Variable Merging

Variables merge with increasing precedence:

```
inventory → group → host
```

Host-level variables override group-level variables, which override inventory-level variables.

## ResolvedInventory

`resolveInventory()` returns a `ResolvedInventory` that:

- Resolves all hosts with merged variables and tags
- Creates connectors lazily on first access
- Caches connectors for reuse
- Implements `AsyncDisposable` for bulk cleanup

```ts
import { start, apply } from 'sysopkit';
import { resolveInventory } from 'sysopkit/inventory';
import { sh } from 'sysopkit/op/sh';

const INVENTORY = {
  vars: { env: 'production' },
  groups: {
    web: {
      vars: { role: 'webserver' },
      tags: ['frontend'],
      hosts: {
        'web-1': { host: '10.0.1.1', options: { user: 'admin' } },
        'web-2': { host: '10.0.1.2', options: { user: 'admin' } },
      },
    },
  },
};

await start(async () => {
  await using hosts = resolveInventory(INVENTORY);

  await apply('setup', hosts.getByGroup('web'), async () => {
    await sh('hostname');
  });
});
```

## Host Selection

| Method             | Description                            |
| ------------------ | -------------------------------------- |
| `getByGroup(name)` | All hosts in a named group             |
| `getByTag(tags)`   | Union of hosts matching any tag        |
| `getByName(name)`  | Single host by name                    |
| `getAll()`         | All hosts                              |
| `match(pattern)`   | Glob pattern matching (`web-*`, `db?`) |

## Host Types

The `type` field selects the connector:

- absent — SSH connector (default)
- `pod` — Podman connector

Unknown types throw at `resolveInventory` time. Custom types pair a factory with your own config member:

```ts
import type { BaseHostConfig, Inventory, SshHostConfig } from 'sysopkit/inventory';

interface K8sHostConfig extends BaseHostConfig {
  readonly type: 'k8s';
  readonly options?: { readonly namespace?: string };
}

type MyHosts = SshHostConfig | K8sHostConfig;

await using hosts = resolveInventory<Inventory<MyHosts>>(inventory, {
  connectors: {
    k8s: (h) => new K8sConnector({ name: h.name, host: h.host }),
  },
});
```

## SSH Authentication

Connection specifics live in per-type `options`, so an explicit `key` or `password` rides the inventory when you need it:

```ts
hosts: {
  'web-1': { host: '10.0.1.1', options: { user: 'admin', key: '~/.ssh/id_ed25519' } },
},
```

Prefer ssh-agent and native OpenSSH config where you can: inventory connections run non-interactively through the system `ssh`, so anything `ssh user@host exit` can do already works — `~/.ssh/config` entries (`Host`, `IdentityFile`, `ProxyJump`), keys loaded in `ssh-agent`, and default keys.

```ssh-config
Host web-1
  HostName 10.0.1.1
  User admin
  IdentityFile ~/.ssh/id_ed25519
```

```sh
ssh-add ~/.ssh/id_ed25519
ssh admin@10.0.1.1 exit # smoke test before running SysopKit
```

For a one-off script you can also skip the inventory and construct `SSHConnector` directly (see [Connectors](/concepts/connectors/)) and pass it to `apply()`.
