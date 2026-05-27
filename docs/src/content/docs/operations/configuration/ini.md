---
title: ini
description: INI file parsing and serialization.
---

```ts
import { serializeIni, parseIni } from 'sysopkit/op/ini';
```

## serializeIni()

Serializes object to INI format text:

```ts
const ini = serializeIni({
  section: {
    key: 'value',
    number: '42',
  },
});
```

## parseIni()

Parses an INI format text into an object.
