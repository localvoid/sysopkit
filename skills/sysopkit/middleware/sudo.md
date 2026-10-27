# sudo middleware

Wraps the current connector so every `spawn` in scope is prefixed with `sudo`.

```typescript
import { sudo } from 'sysopkit/middleware/sudo';

await sudo(async () => { /* every spawn prefixed with sudo */ }, {
  user: 'root', password?, role?, preserveEnv?: boolean | string[],
});
```

- Options fall back to context vars (`SUDO_USER`, `SUDO_PASSWORD`, `SUDO_PRESERVE_ENV`, `SUDO_ROLE`), so `start`/`apply`/`task`/`utility` `vars` can supply them (e.g. one password for a run). Inventory host/group `vars` live on the connector object and are **not** visible to `ctx.tryGet()`, so they cannot supply sudo options.
- Builds `sudo -H [-u user] [-r role] [-E | --preserve-env=a,b]`.
- Layers stack by nesting: `sudo(() => trace(() => …))` means sudo wraps trace wraps the raw connector. The generic `middleware(name, fn, wrap)` primitive throws when the parent frame has no connector.

## With a password

Appends `-S -p ASKPASS-<uuid>`, watches stderr for the UUID prompt, writes `password\n` to stdin, and strips the prompt from stderr. A second prompt (wrong password) throws. User stdin is buffered until auth completes. Passwords are held as `Uint8Array` in memory.

## Without a password

Appends `-n` (fail fast, never prompt). Passwordless sudo or NOPASSWD rules are required; otherwise the op fails instead of hanging.

## Rules

- Watch **stderr** only. A sudo configured to prompt elsewhere hangs until abort or timeout.
- One response per spawn.
- Other wrappers (`trace`, `expectStderrPrompt`, `TransformCmdMiddleware`) are in [others](others.md).
