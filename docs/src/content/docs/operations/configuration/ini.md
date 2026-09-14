---
title: ini
description: Parse and serialize INI-format text.
---

```ts
import { serializeIni } from 'sysopkit/op/ini';
```

## serializeIni()

Serializes an object to INI-format text.

```ts
const ini = serializeIni({
  section: {
    key: 'value',
    number: '42',
  },
});
```
