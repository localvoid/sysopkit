---
title: ssh
description: SSH configuration serialization.
---

```ts
import { serializeSshConf } from 'sysopkit/op/ssh';
```

## serializeSshConf()

Serializes an SSH configuration object to `ssh_config` format:

```ts
const config = serializeSshConf({
  'Host github.com': {
    HostName: 'github.com',
    User: 'git',
    IdentityFile: '~/.ssh/id_ed25519',
  },
});
```

Output:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
```
