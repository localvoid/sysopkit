---
title: Inventory
description: Define hosts and groups with typed variables.
---

SysopKit inventory system provides Ansible-like host management.

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
  host?: string; // Connection target (hostname, IP, or prefix)
  user?: string; // Username for authentication
  port?: number; // Port number
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
import { start, resolveInventory, apply } from 'sysopkit';
import { sh } from 'sysopkit/op/sh';

const INVENTORY = {
  vars: { env: 'production' },
  groups: {
    web: {
      vars: { role: 'webserver' },
      tags: ['frontend'],
      hosts: {
        'web-1': { host: '10.0.1.1', user: 'admin' },
        'web-2': { host: '10.0.1.2', user: 'admin' },
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

## Connection Prefixes

Host strings with prefixes determine connection type:

- `ssh:hostname` — SSH connector (default for any hostname)
- `pod:container` — Podman connector

Custom factories can be registered:

```ts
await using hosts = resolveInventory(inventory, {
  connectors: {
    k8s: (host) => new K8sConnector({ name: host }),
  },
});
```
