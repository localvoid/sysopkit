# sudo middleware

```typescript
import { sudo, SUDO_USER, SUDO_PASSWORD } from 'sysopkit/middleware/sudo';
```

The most common middleware — wraps the current connector so every `spawn` in
scope is prefixed with `sudo`.

```typescript
import { sudo, SUDO_USER, SUDO_PASSWORD } from 'sysopkit/middleware/sudo';

await sudo(async () => { /* every spawn prefixed with sudo */ }, {
  user: 'root', password?, role?, preserveEnv?: boolean | string[],
});
```

- Options fall back to context vars (`SUDO_USER`, `SUDO_PASSWORD`,
  `SUDO_PRESERVE_ENV`, `SUDO_ROLE`), so `start`/`apply`/`task`/`utility` `vars`
  can supply them (e.g. one password for a whole run). Inventory host/group
  `vars` live on the connector object and are **not** visible to `ctx.tryGet()`,
  so they do not supply sudo options.
- Builds `sudo -H [-u user] [-r role] [-E | --preserve-env=a,b]`.
- Layers stack by nesting: `sudo(() => trace(() => …))` means sudo wraps trace
  wraps the raw connector. The generic `middleware(name, fn, wrap)` primitive
  throws if the parent context has no connector.

## With password

Appends `-S -p ASKPASS-<uuid>`, watches stderr for the UUID prompt, writes
`password\n` to stdin, strips the prompt from stderr. A second prompt (wrong
password) throws. User stdin is buffered until auth completes. Passwords are
held as `Uint8Array` in memory.

## Without password

Appends `-n` (fail fast, never prompt) — passwordless sudo or NOPASSWD rules
are required, otherwise the op fails instead of hanging.

## Pitfalls

- Only **stderr** is watched — a sudo configured to prompt elsewhere hangs
  until abort/timeout. One-shot response per spawn.
- For other wrappers (`trace`, `expectStderrPrompt`, `TransformCmdMiddleware`),
  see [others](others.md).
