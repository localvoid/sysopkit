---
title: Middleware
description: Composable decorators that wrap connectors with additional behavior.
---

Middleware wraps connectors using the decorator pattern. The `middleware()` function creates a new context with the wrapped connector and runs the provided function within it.

## SudoMiddleware

Prepends `sudo` to commands with configurable user, role, and environment preservation.

```ts
import { sudo } from 'sysopkit/middleware/sudo';

await sudo(async () => {
  await sh('apt install -y nginx');
});
```

Options can be passed explicitly or read from context variables:

```ts
import { sudo, SUDO_USER, SUDO_PASSWORD } from 'sysopkit/middleware/sudo';

await sudo(
  async () => {
    await sh('whoami'); // prints the sudo target user
  },
  { user: 'www-data' },
);
```

Context variables control sudo behavior:

- `SUDO_USER` — target user
- `SUDO_PASSWORD` — password for sudo prompts
- `SUDO_PRESERVE_ENV` — preserve environment variables
- `SUDO_ROLE` — SELinux role

## TraceMiddleware

Pipes stdout and stderr through `TransformStream`s and reports output via the reporter.

```ts
import { trace } from 'sysopkit/middleware/trace';

await trace(async () => {
  await sh('apt install -y nginx');
});
```

Output is buffered and flushed on stream end. Each chunk is reported via `reporter.info()` for stdout and `reporter.error()` for stderr.

## ExpectPromptMiddleware

Watches stderr for a pattern and writes a response to stdin. Useful for interactive prompts.

```ts
import { expectStderrPrompt } from 'sysopkit/middleware/expect';

await expectStderrPrompt(
  async () => {
    await sh('ssh-keygen -f /root/.ssh/id_rsa');
  },
  { pattern: /passphrase/, response: '\n' },
);
```

Only responds once — after the first match, subsequent writes pass through normally.

## TransformCmdMiddleware

Transforms command arrays before execution. Useful for wrapping commands in a shell or adding prefixes.

```ts
import { TransformCmdMiddleware } from 'sysopkit/middleware/transform-cmd';

const noLog = new TransformCmdMiddleware(connector, {
  transform: (cmd) => ['env', 'DISABLE_LOGGING=1', ...cmd],
});
```

## Stacking Middleware

Middlewares compose naturally — each layer wraps the next:

```ts
await sudo(async () => {
  await trace(async () => {
    await sh('apt install -y nginx');
  });
});
```

This results in the execution chain: `sudo → trace → connector`.
