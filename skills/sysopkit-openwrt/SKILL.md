---
name: sysopkit-openwrt
description: OpenWrt UCI configuration with sysopkit. Use when writing or debugging OpenWrt router configs — typed UCI sections (network, wireless, firewall, system, dhcp, dropbear, sqm, upnpd), serializeUci, and the serialize-write-reload workflow. Requires the sysopkit skill for execution model, connectors, and apply().
---

# SysopKit OpenWrt

Typed OpenWrt UCI builders (`@sysopkit/openwrt/uci/*`). Pure
serializers — no transport, no apply ops. Combine with the `sysopkit` skill
(`start`, `apply`, `createFile`, `sh`) for execution.

## Workflow

```typescript
import { serializeUci } from '@sysopkit/openwrt/uci';
import type { UciNetwork } from '@sysopkit/openwrt/uci/network';
import { createFile } from 'sysopkit/op/file';
import { sh } from 'sysopkit/op/sh';

const config: UciNetwork = [ /* typed sections, see configs.md */ ];
await createFile({ path: '/etc/config/network', content: serializeUci(config) });
await sh('/etc/init.d/network reload'); // subsystem reload; varies per config
```

`serializeUci` output replaces the whole `/etc/config/<name>` file, so always
build the complete config (all sections), not a delta. `createFile` is
idempotent — reload only when it changed (latch on `onChange`, see the
`sysopkit` skill's `events-changes.md`).

## Router

| Task | Read |
| --- | --- |
| `UciConfig` / `UciSection` model, `serializeUci`, write-and-reload pattern | [uci.md](uci.md) |
| Per-config section types: network, wireless, firewall, system, dhcp, dropbear, sqm, upnpd | [configs.md](configs.md) |

## Pitfalls

- Full-file replace: omitting a section **deletes** it from the device config.
- Reload command differs per subsystem (`network reload`, firewall restart,
  `uci commit` + service reload) — sending the wrong one silently applies
  nothing.
- Option values are strings on the wire; the types allow `string | number` —
  confirm device-side parsing for numeric options.
