---
title: sysusers
description: Declarative system user and group management (sysusers.d).
---

Parsing and serialization for `sysusers.d` configuration files, used to declaratively create system users and groups at boot time.

```ts
import { parseSysusersConf, serializeSysusersConf } from '@sysopkit/linux/systemd/sysusers';
import type { SysusersConf, SysusersEntry, SysusersType } from '@sysopkit/linux/systemd/sysusers';
```

## Usage

```ts
const entries = parseSysusersConf(`
u nginx - "Nginx web server" /var/lib/nginx /sbin/nologin
g myapp - 
m alice myapp
`);

const content = serializeSysusersConf([
  {
    type: 'u',
    name: 'nginx',
    id: '-',
    gecos: 'Nginx web server',
    home: '/var/lib/nginx',
    shell: '/sbin/nologin',
  },
  { type: 'g', name: 'myapp' },
  { type: 'm', name: 'alice', id: 'myapp' },
]);
```

## Types

### SysusersEntry

```ts
type SysusersEntry = {
  type: 'u' | 'u!' | 'g' | 'm' | 'r';
  name: string;
  id?: string | number;
  gecos?: string;
  home?: string;
  shell?: string;
};
```

| Type | Description                                              |
| ---- | -------------------------------------------------------- |
| `u`  | Create system user and group                             |
| `u!` | Create user with fully locked account (no password auth) |
| `g`  | Create system group only                                 |
| `m`  | Add user to group                                        |
| `r`  | Add UID/GID range to allocation pool                     |

### Entry Fields

| Field   | Description                                                                   |
| ------- | ----------------------------------------------------------------------------- |
| `name`  | User or group name (1-31 chars, alphanumeric with `_` and `-`).               |
| `id`    | UID/GID, `"-"` for auto, or `"uid:gid"` format. For `m` type: the group name. |
| `gecos` | User description (GECOS field), only for `u`/`u!` types.                      |
| `home`  | Home directory path, only for `u`/`u!` types.                                 |
| `shell` | Login shell, only for `u`/`u!` types.                                         |
