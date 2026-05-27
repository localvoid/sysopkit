# @sysopkit/cli

CLI utilities for building interactive terminal interfaces. Provides interactive prompt helpers (password input, selection menus, yes/no confirmations).

## Installation

```sh
bun add @sysopkit/cli
```

## Usage

```ts
import { password, select, confirm, InterruptError } from '@sysopkit/cli';

// Password prompt
try {
  const pwd = await password('Enter password: ');
} catch (e) {
  if (e instanceof InterruptError) {
    // User pressed Ctrl+C
  }
}

// Selection menu
const choice = await select('Choose a server:', {
  Production: 'prod',
  Staging: 'staging',
  Development: 'dev',
});

// Yes/No confirmation
const ok = await confirm('Are you sure?');
```

## API

### `password(query: string, silent?: boolean): Promise<string>`

Prompt the user for a password with optional echo masking.

- `query` – Prompt text written to stdout
- `silent` – When `false` (default), typed characters are echoed as `*`. When `true`, no visual feedback is given

**Keybindings:**

| Key       | Action                 |
| --------- | ---------------------- |
| Enter     | Submit                 |
| Ctrl+C    | Throw `InterruptError` |
| Ctrl+U    | Clear entire line      |
| Ctrl+W    | Delete last word       |
| Backspace | Delete last character  |

### `select<T>(query: string, options: Record<string, T>): Promise<T>`

Render an interactive selection menu with keyboard navigation.

- `query` – Prompt text
- `options` – Record mapping display labels to values

Returns the value associated with the selected option.

**Navigation:**

| Key        | Action                      |
| ---------- | --------------------------- |
| Up arrow   | Move selection up (wraps)   |
| Down arrow | Move selection down (wraps) |
| Enter      | Confirm selection           |
| Ctrl+C     | Throw `InterruptError`      |

### `confirm(query: string): Promise<boolean>`

Prompt for a yes/no confirmation. Convenience wrapper around `select` with `{ Yes: true, No: false }` options.

### `InterruptError`

Error thrown when user interrupts an interactive prompt with Ctrl+C.

```ts
if (error instanceof InterruptError) {
  // Handle cancellation
}
```

## Terminal Escape Sequences

The package also provides ANSI escape sequence constants and helper functions for cursor control and screen manipulation.

### Constants

| Constant           | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `CURSOR_START`     | Carriage return – move cursor to start of current line |
| `CURSOR_UP`        | Move cursor up one line                                |
| `CURSOR_DOWN`      | Move cursor down one line                              |
| `CURSOR_PREV_LINE` | Move cursor to beginning of previous line              |
| `CURSOR_NEXT_LINE` | Move cursor to beginning of next line                  |
| `CURSOR_LEFT`      | Move cursor to column 0 of current line                |
| `CURSOR_HIDE`      | Hide the cursor                                        |
| `CURSOR_SHOW`      | Show the cursor                                        |
| `CURSOR_SAVE`      | Save cursor position and attributes                    |
| `CURSOR_RESTORE`   | Restore cursor position and attributes                 |
| `SCROLL_UP`        | Scroll terminal buffer up by one line                  |
| `SCROLL_DOWN`      | Scroll terminal buffer down by one line                |
| `ERASE_SCREEN`     | Erase entire screen                                    |
| `ERASE_UP`         | Erase from cursor to beginning of screen               |
| `ERASE_DOWN`       | Erase from cursor to end of screen                     |
| `ERASE_LINE`       | Erase entire current line                              |
| `ERASE_LINE_END`   | Erase from cursor to end of line                       |
| `ERASE_LINE_START` | Erase from cursor to start of line                     |
| `CLEAR_SCREEN`     | Reset terminal (full reset escape sequence)            |

### Functions

#### `cursorMoveTo(x: number, y: number): string`

Move cursor to absolute position. When `y` is 0, moves only horizontally to column `x + 1` on the current line.

#### `cursorMoveUp(i: number): string`

Move cursor up by `i` lines.

#### `cursorMoveDown(i: number): string`

Move cursor down by `i` lines.

#### `cursorMoveForward(i: number): string`

Move cursor forward by `i` columns.

#### `cursorMoveBackward(i: number): string`

Move cursor backward by `i` columns.

#### `cursorMove(x: number, y: number): string`

Move cursor by relative offset. Negative values move left/up, positive values move right/down.

#### `eraseLines(count: number): string`

Erase `count` lines above and including the current line, then return cursor to line start.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))
