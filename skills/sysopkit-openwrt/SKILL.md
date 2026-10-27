---
name: sysopkit-openwrt
description: 'OpenWrt UCI configs in SysopKit: typed sections for network, wireless, firewall, system, dhcp, dropbear, sqm, and upnpd; serializeUci; full-file replace and reload.'
---

# SysopKit OpenWrt

Typed UCI builders (`@sysopkit/openwrt/uci/*`). Pure serializers: no transport, no apply ops. Pair with the `sysopkit` skill for `start`/`apply`/`createFile`/`sh`.

## Write a config

1. Build the **complete** array for `/etc/config/<name>` — every section the device should keep. Omitting a section deletes it from the device.
2. Serialize and write with the idempotent `createFile`. It emits a change only when the content differs.
3. Latch the change, then reload the owning subsystem only when it fired.

```typescript
import type { UciNetwork } from '@sysopkit/openwrt/uci/network';
import { serializeUci } from '@sysopkit/openwrt/uci';
import { onChange, latch } from 'sysopkit';
import { createFile } from 'sysopkit/op/file';
import { sh } from 'sysopkit/op/sh';

const config: UciNetwork = [/* every section, see configs.md */];
const changed = latch();
await onChange(changed, async () => {
  await createFile({ path: '/etc/config/network', content: serializeUci(config) });
});
if (changed()) await sh('/etc/init.d/network reload');
```

Done when a second run writes nothing and reloads nothing. A write without the matching reload changes nothing at runtime; the reload command is per subsystem ([configs](configs.md)).

## Route by config

| Task | Read |
| --- | --- |
| `UciConfig`/`UciSection` model, `serializeUci` output, config-specific narrowing | [uci.md](uci.md) |
| Section types and reload command per config: network, wireless, firewall, system, dhcp, dropbear, sqm, upnpd | [configs.md](configs.md) |

## Rules

- Match section `type` strings to the device's UCI types exactly. A typo produces a config the daemon ignores without error.
- `serializeUci` is pure string building: no schema validation, no `uci commit`. For `/etc/config/*`, the file write is the commit; `uci commit` matters only when editing through the `uci` CLI.
- Values reach the device as strings even when the type allows `number`. Confirm device-side parsing for numeric options.
- Keep secrets (WPA keys, PPPoE passwords) in inventory vars. The serialized file lands on the device in plaintext.
