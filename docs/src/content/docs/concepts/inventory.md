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

Unknown prefixes fall back to the SSH connector with the remainder after `:` as the host, so prefer explicit `ssh:` or bare hostnames.

Custom factories can be registered:

```ts
await using hosts = resolveInventory(inventory, {
  connectors: {
    k8s: (host) => new K8sConnector({ name: host }),
  },
});
```

## SSH Authentication

`HostConfig` has no `key` or `password` fields by design. Inventory only carries `host`, `user`, and `port` — authentication is delegated to your native OpenSSH client and ssh-agent.

SysopKit shells out to the system `ssh`, and inventory connections run non-interactively, so anything `ssh user@host exit` can do already works: `~/.ssh/config` entries (`Host`, `IdentityFile`, `ProxyJump`), keys loaded in `ssh-agent`, and default keys.

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

If you need an explicit `key` or `password` for a one-off script, skip the inventory and construct `SSHConnector` directly (see [Connectors](/concepts/connectors/)) and pass it to `apply()`.
