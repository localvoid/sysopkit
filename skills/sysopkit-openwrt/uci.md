# UCI model and workflow

```typescript
import { serializeUci } from '@sysopkit/openwrt/uci';
import type { UciConfig, UciSection } from '@sysopkit/openwrt/uci';
```

## Types

```typescript
type UciConfig<T extends string> = UciSection<T>[];
interface UciSection<T extends string> {
  type: T;
  name?: string;
  options?: Record<string, string | number>;
  lists?: Record<string, string[]>;
}
function serializeUci<T extends string>(config: UciConfig<T>): string;
```

Emits `config <type> '<name>'` blocks with `option` / `list` lines. Anonymous
sections omit `name`. Every `@sysopkit/openwrt/uci/<name>` submodule narrows this shape with a
config-specific union (e.g. `UciNetwork = UciNetworkSection[]`) — see
[configs](configs.md).

## Workflow: serialize → write → reload

The package has no transport of its own. Standard pattern inside `apply()`:

1. Build the **complete** `UciConfig` (all sections — output replaces the
   whole `/etc/config/<name>` file).
2. `serializeUci(config)` and write with idempotent `createFile`.
3. Reload the owning subsystem **only on change** (wrap in `onChange` + latch):

```typescript
import { onChange, latch } from 'sysopkit';

const reloaded = latch();
await onChange(reloaded, async () => {
  await createFile({ path: '/etc/config/wireless', content: serializeUci(wifi) });
});
if (reloaded()) await sh('wifi reload');
```

## Pitfalls

- Partial configs destroy device state — a missing section is a deleted
  section after write.
- `serializeUci` is pure string building: no validation against the device's
  UCI schema, no `uci commit`. The file write *is* the commit for
  `/etc/config/*` files; `uci commit <config>` only matters when mutating via
  the `uci` CLI.
- Keep secrets (WPA keys, PPPoE passwords) in inventory vars, not in
  committed source — the serialized file lands on the device in plaintext.
