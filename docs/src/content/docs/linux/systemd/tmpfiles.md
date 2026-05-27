---
title: tmpfiles
description: Volatile file management (tmpfiles.d).
---

Parsing and serialization for `tmpfiles.d` configuration files, used to create, clean, and manage volatile files and directories at boot time.

```ts
import { parseTmpFilesConf, serializeTmpFilesConf } from '@sysopkit/linux/systemd/tmpfiles';
import type { TmpFilesConf, TmpFilesEntry, TmpfilesType } from '@sysopkit/linux/systemd/tmpfiles';
```

## Usage

```ts
const entries = parseTmpFilesConf(`
d /run/myapp 0755 root root -
f /etc/myapp/config 0644 root root - "key=value"
`);

const content = serializeTmpFilesConf([
  { type: 'd', path: '/run/myapp', mode: '0755', user: 'root', group: 'root' },
  {
    type: 'f',
    path: '/etc/myapp/config',
    mode: '0644',
    user: 'root',
    group: 'root',
    argument: 'key=value',
  },
]);
```

## Types

### TmpFilesEntry

```ts
type TmpFilesEntry = {
  type: TmpfilesType;
  path: string;
  mode?: string | number;
  user?: string;
  group?: string;
  age?: string;
  argument?: string;
};
```

### Line Type Reference

| Type       | Action                                          |
| ---------- | ----------------------------------------------- |
| `f` / `f+` | Create or truncate file                         |
| `w` / `w+` | Write to existing file                          |
| `d` / `D`  | Create directory (D also removes on `--remove`) |
| `e`        | Clean existing directory contents               |
| `L` / `L+` | Create symlink                                  |
| `c` / `b`  | Create character/block device node              |
| `C` / `C+` | Copy files or directory trees                   |
| `x` / `X`  | Ignore path during cleanup                      |
| `r` / `R`  | Remove path (R recursive)                       |
| `z` / `Z`  | Adjust mode/ownership (Z recursive)             |
| `t` / `T`  | Set extended attributes (T recursive)           |
| `h` / `H`  | Set file attributes (H recursive)               |
| `a` / `A`  | Set POSIX ACLs                                  |

Type modifiers: `!` (boot-only), `-` (ignore errors), `=` (check file type), `~` (base64 argument).

### Entry Fields

| Field | Description |
| --- | --- |
| `type` | Line type determining the action. |
| `path` | Absolute path for the file/directory. |
| `mode` | File access mode (octal, e.g. `"0755"`). |
| `user` / `group` | Owner user and group. |
| `age` | Time-based cleanup age (e.g., `"10d"`, `"1w"`). |
| `argument` | Content for `f`/`w` types, symlink target for `L`, device major:minor for `c`/`b`. |
