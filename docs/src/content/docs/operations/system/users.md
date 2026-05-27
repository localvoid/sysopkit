---
title: users
description: User and group management operations.
---

```ts
import { createUser, deleteUser, createGroup, deleteGroup } from 'sysopkit/op/users';
```

## createUser()

> **IDEMPOTENT**

Creates a system user:

```ts
await createUser({
  name: 'app',
  uid: 1001,
  gid: 1001,
  home: '/home/app',
  shell: '/bin/bash',
  groups: ['www-data'],
});
```

## deleteUser()

> **IDEMPOTENT**

Removes a user:

```ts
await deleteUser({ name: 'app', removeHome: true });
```

## createGroup() / deleteGroup()

> **IDEMPOTENT**

Creates or removes a group:

```ts
await createGroup({ name: 'app', gid: 1001 });
await deleteGroup({ name: 'old-group' });
```
