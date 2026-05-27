---
title: System Configuration
description: Limits, sysctl, and sudoers configuration operations.
---

Parsing and serialization utilities for Linux system configuration files.

## Limits

```ts
import { parseLimitsConf, serializeLimitsConf } from '@sysopkit/linux/limits';
```

Parser and serializer for `/etc/security/limits.conf`. Handles user resource limit rules with domain, type (`soft`/`hard`/`-`), item, and value fields.

```ts
const entries = parseLimitsConf(`* soft nofile 65535
* hard nofile 65535`);

// [{ domain: '*', limitType: 'soft', item: 'nofile', value: '65535' },
//  { domain: '*', limitType: 'hard', item: 'nofile', value: '65535' }]
```

### parseLimitsConf()

Parses limits.conf content into structured `LimitsEntry[]`.

### serializeLimitsConf()

Serializes `LimitsEntry[]` into limits.conf format.

## Sysctl

```ts
import { parseSysctlConf, serializeSysctlConf } from '@sysopkit/linux/sysctl';
```

Parser and serializer for `sysctl.conf` kernel parameter configuration.

```ts
const conf = parseSysctlConf('net.ipv4.ip_forward = 1\nnet.core.somaxconn = 65535');
// { 'net.ipv4.ip_forward': '1', 'net.core.somaxconn': '65535' }
```

### parseSysctlConf()

Parses sysctl.conf content into key-value pairs.

### serializeSysctlConf()

Serializes key-value pairs into sysctl.conf format.

## Sudoers

```ts
import { serializeSudoersConf } from '@sysopkit/linux/sudoers';
```

Serializer for `/etc/sudoers` rule files.

```ts
const content = serializeSudoersConf([
  {
    user: '%wheel',
    hosts: ['ALL'],
    runas: 'ALL',
    commands: ['ALL'],
    nopasswd: true,
  },
]);
// '%wheel ALL = (ALL) NOPASSWD: ALL\n'
```

### serializeSudoersConf()

Serializes `SudoersConf` rules into sudoers file format.
