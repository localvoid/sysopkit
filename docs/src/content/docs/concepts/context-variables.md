---
title: Context Variables
description: Typed, scope-safe context variables with parent-chain lookup.
---

Context variables use branded symbols (`Var<T>`) to provide type-safe access to variables.

## Var Type

```typescript
type Var<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.var';
};
```

Variables are looked up via parent-chain traversal. A child context can access variables from any ancestor context.

## Using Variables

```typescript
import { task } from 'sysopkit';

task('inner', async (ctx) => {
  const value = ctx.tryGet(MY_VAR); // returns T | undefined
  const guaranteed = ctx.get(MY_VAR); // returns T, throws if absent
});
```

## Built-in Variables

| Variable            | Type                       | Description             |
| ------------------- | -------------------------- | ----------------------- |
| `SSH_AUTH_SOCKET`   | `Var<string>`              | SSH agent socket path   |
| `SUDO_USER`         | `Var<string>`              | Default sudo user       |
| `SUDO_PASSWORD`     | `Var<string>`              | Default sudo password   |
| `SUDO_ROLE`         | `Var<string>`              | SELinux role for sudo   |
| `SUDO_PRESERVE_ENV` | `Var<boolean \| string[]>` | Preserved sudo env vars |

## Setting Variables

Variables are typically set when creating a context:

```typescript
import { start } from 'sysopkit/start';
import { SUDO_PASSWORD } from 'sysopkit/middleware/sudo';

await start(
  async () => {
    // sudo middleware will read SUDO_PASSWORD from context
    await sudo(async () => {
      await sh('whoami');
    });
  },
  {
    vars: { [SUDO_PASSWORD]: 'secret' },
  },
);
```
