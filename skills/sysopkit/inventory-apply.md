# Inventory and apply

```typescript
import { resolveInventory } from 'sysopkit/inventory';
import { apply, ApplyError } from 'sysopkit';
```

## Defining inventory

```typescript
import { resolveInventory } from 'sysopkit/inventory';

await using hosts = resolveInventory({
  vars: { [SUDO_PASSWORD]: 'secret' },   // global vars
  groups: {
    web: {
      vars: { … }, tags: ['frontend'],    // group vars/tags
      hosts: {
        'web-1': { host: '192.168.1.10', user: 'admin', port?, vars?, tags? },
        'db-1':  { host: 'pod:postgres' }, // prefix selects connector
      },
    },
  },
}, { connectors?: { 'k8s': (host, h) => new MyConnector(host) } });
```

- **Host prefixes** (split on first `:`) select the connector: `ssh:` (default
  when no known prefix matches) and `pod:`. `pod:` requires a non-empty
  container id, `ssh:` a non-empty host — else it throws. Unknown prefixes fall
  back to `SSHConnector` with the remainder after `:` as the host, so prefer
  explicit `ssh:` or bare hostnames. Custom factories are keyed by the bare
  prefix (`k8s`, not `k8s:`), merge over the defaults, and receive the host
  string *after* the prefix.
- Bare `host` (no prefix) falls back to `SSHConnector`; the inventory `name`
  (`web-1`) becomes the connector `name` used in reporter output.
- **Var merging** is a shallow spread, precedence
  `inventory → group → host`. Symbol keys (`Var<T>`) are supported.
- **Tags** are a deduplicated union of group + host tags.
- `resolveInventory` returns a `ResolvedInventory` that creates connectors
  **lazily on first access** and caches them. It is `AsyncDisposable` — always
  `await using` it, or SSH sockets leak.

## Selecting hosts

| Method | Meaning |
| --- | --- |
| `getByGroup(name)` | All hosts in the group (`[]` if unknown) |
| `getByTag(tags)` | Union over tags, deduplicated |
| `getByName(name)` | One host, or `undefined` |
| `getAll()` | Everything |
| `match(pattern)` | Glob on inventory **name** only (`*` → `.*`, `?` → `.`) |

Accessors throw `ResolvedInventory has been disposed` after dispose, and each
call reuses the cached connector for that name.

## apply

```typescript
// Single host — returns { success, conn, result }; throws ApplyError on failure
await apply('name', connector, async (ctx) => { … });

// Many hosts — parallel batches; returns ApplyResult[]; throws past threshold
await apply('name', hosts.getAll(), async (ctx) => { … },
  { batchSize?: 5, maxFailPercent?: 20 });
```

- Every `apply` creates an `apply` context; each host gets a child `connector`
  context; `apply` calls `conn.connect(signal)` then `fn(ctx)`.
- `fn` errors become `{ success: false, conn, error }` per host (with
  `reporter.ctxError`). **`connect()` errors are not captured** — they propagate
  and abort the whole `apply` (in multi-host mode the entire batch promise
  rejects; there is no per-host result for that host).
- `batchSize ?? 5`; `batchSize: Infinity` runs one giant batch.
  `batchSize` must be `>= 1` (or `Infinity`) — `0` or negative never advances
  the batch loop.
- `maxFailPercent ?? 100`; `failLimit = ceil(n * pct / 100)`. After each batch,
  if `failCount > failLimit`, unprocessed hosts are marked
  `{ success: false, error: 'Aborted due to max failures exceeded' }` and an
  `ApplyError` (extends `AggregateError`, carries `.results`) is thrown.
- Below the threshold, multi-host `apply` **returns** the mixed array without
  throwing — you must inspect it. `maxFailPercent: 0` still lets the first batch
  complete before aborting (`failLimit = 0`, strict `>` comparison).

```typescript
try {
  const results = await apply('deploy', conns, fn, { batchSize: 5, maxFailPercent: 20 });
  for (const r of results) if (!r.success) console.error(r.conn.name, r.error);
} catch (e) {
  if (e instanceof ApplyError) for (const r of e.results) { /* per-host detail */ }
  throw e;
}
```

## Gotchas

- Single vs multi return shapes differ (object vs array). Overload resolution
  depends on `Connector` vs `Connector[]` — passing `getByName()` (possibly
  `undefined`) into single mode is a type error; guard it.
- `apply` `vars` live on the apply context, visible to `fn` and its children via
  parent-chain lookup. Inventory host/group `vars` live on the connector object
  (`conn.vars`), not in the context chain — `ctx.tryGet()` does not see them.
  Pass `SUDO_*` and similar context vars via `start`/`apply`/`task`/`utility`
  `vars`, not inventory host vars.
- `match()` globs the inventory name, not the `host` address.
