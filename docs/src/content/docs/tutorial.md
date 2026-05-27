---
title: Tutorial — Provision a Web Server
description: Step-by-step walkthrough of provisioning a web server with SysopKit.
---

This tutorial walks through a complete automation scenario: provisioning a web server with nginx, config file and a firewall rule.

## Prerequisites

- SysopKit installed in a project or globally
- Access to a target host via SSH

## Step 1: Create the Entry Point

Every SysopKit script starts with `start()`, which creates a root execution context:

```ts
import { start } from 'sysopkit/start';

await start(async () => {
  // Your automation logic here
});
```

## Step 2: Define the Host

Define the target host with SSH connector.

```ts
await start(async () => {
  await using c = new SSHConnector({ host: '192.168.1.10', user: 'sysop' });
});
```

The `await using` pattern ensures that SSH connection is cleaned up when script exits.

## Step 3: Apply Operations to Host

Use `apply()` to run operations against one or more hosts:

```ts
import { apply } from 'sysopkit';
import { start } from 'sysopkit/start';
import { SSHConnector } from 'sysopkit/connector/ssh';
import { sh } from 'sysopkit/op/sh';

await start(async () => {
  await using c = new SSHConnector({ host: '192.168.1.10', user: 'sysop' });

  await apply('provision web', c, async () => {
    await sh('hostname');
  });
});
```

## Step 4: Run Commands with Privilege Escalation

Many system operations require root. Use `sudo()` middleware to elevate privileges:

```ts
import { sudo } from 'sysopkit/middleware/sudo';

await apply('provision web', c, async () => {
  await sudo(async () => {
    await sh('apt update');
    await sh('apt install -y nginx');
  });
});
```

## Step 5: Manage Files

Use file operations to create configuration files idempotently:

```ts
import { createFile } from 'sysopkit/op/file';

await sudo(async () => {
  await createFile({
    path: '/etc/nginx/sites-available/default',
    content: `server {
  listen 80 default_server;
  root /var/www/html;
  index index.html;
}`,
    mode: 0o644,
    user: 'root',
    group: 'root',
  });
});
```

## Step 6: Track Changes

Use `onChange()` to react to config changes:

```ts
import { onChange, latch } from 'sysopkit';

const configChanged = latch();
await onChange(configChanged, async () => {
  await createFile({
    path: '/etc/nginx/sites-available/default',
    content: NGINX_CONFIG,
    mode: 0o644,
    user: 'root',
    group: 'root',
  });
});

if (configChanged()) {
  await sh('systemctl reload nginx');
}
```

## Step 7: Organize with Tasks

Use `task()` to group related operations with named context:

```ts
import { task } from 'sysopkit';

await sudo(async () => {
  await task('install packages', async () => {
    await sh('apt install -y nginx ufw');
  });

  await task('configure firewall', async () => {
    await sh('ufw allow 80/tcp');
    await sh('ufw allow 443/tcp');
  });

  await task('enable services', async () => {
    await sh('systemctl enable --now nginx');
    await sh('systemctl enable --now ufw');
  });
});
```

## Complete Script

```ts
import { apply, task, onChange, latch } from 'sysopkit';
import { start } from 'sysopkit/start';
import { SSHConnector } from 'sysopkit/connector/ssh';
import { sudo } from 'sysopkit/middleware/sudo';
import { createFile } from 'sysopkit/op/file';
import { sh } from 'sysopkit/op/sh';

const NGINX_CONFIG = `server {
  listen 80 default_server;
  root /var/www/html;
  index index.html;
}`;

await start(async () => {
  await using c = new SSHConnector({ host: '192.168.1.10', user: 'sysop' });

  await apply('provision web', hosts.getByGroup('web'), async () => {
    await sudo(async () => {
      await task('install packages', async () => {
        await sh('apt update');
        await sh('apt install -y nginx ufw');
      });

      const configChanged = latch();
      await onChange(configChanged, async () => {
        await createFile({
          path: '/etc/nginx/sites-available/default',
          content: NGINX_CONFIG,
          mode: 0o644,
          user: 'root',
          group: 'root',
        });
      });

      if (configChanged()) {
        await task('reload nginx', async () => {
          await sh('systemctl reload nginx');
        });
      }

      await task('configure firewall', async () => {
        await sh('ufw --force enable');
        await sh('ufw allow 80/tcp');
        await sh('ufw allow 22/tcp');
      });
    });
  });
});
```
