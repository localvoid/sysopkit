# @sysopkit/cli

Interactive terminal prompts for [SysopKit](https://www.sysopkit.com) workflows: password input, selection menus, yes/no confirmations. Requires a TTY (uses raw-mode stdin).

## Installation

```sh
bun add @sysopkit/cli
# pnpm add @sysopkit/cli
# npm install @sysopkit/cli
```

## Usage

```typescript
import { password, select, confirm, InterruptError } from '@sysopkit/cli';

try {
  const pwd = await password('Enter sudo password: ');
  const env = await select('Choose a target:', { Production: 'prod', Staging: 'staging' });
  const ok = await confirm('Apply changes?');
  if (!ok) return;
} catch (err) {
  if (err instanceof InterruptError) return; // user pressed Ctrl+C
  throw err;
}
```

## API

- `password(query, silent = false)` — raw-mode input; `*` echo unless `silent`. Keys: Enter submit, Ctrl+C → `InterruptError`, Ctrl+U clear line, Ctrl+W delete word, Backspace delete char.
- `select<T>(query, options: Record<string, T>)` — arrow-key menu (Up/Down wrap, Enter confirm, Ctrl+C → `InterruptError`); resolves the chosen value.
- `confirm(query)` — `select` wrapper with `{ Yes: true, No: false }`.
- `InterruptError` — thrown on Ctrl+C in any prompt.

ANSI cursor/erase helpers (`CURSOR_*`, `ERASE_*`, `cursorMove*`, `eraseLines`) are exported from `@sysopkit/cli` for custom prompt rendering.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](../../../LICENSE-APACHE))
- MIT license ([LICENSE-MIT](../../../LICENSE-MIT))
