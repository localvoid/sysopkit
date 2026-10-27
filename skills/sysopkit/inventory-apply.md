# Inventory and apply

Resolve targets, select hosts, run one function per host.

## Define inventory

```typescript
import { SUDO_PASSWORD } from 'sysopkit/middleware/sudo';
import { resolveInventory } from 'sysopkit/inventory';

await using hosts = resolveInventory({
  vars: { [SUDO_PASSWORD]: 'secret' },   // global vars
  groups: {
    web: {
      vars: { … }, tags: ['frontend'],    // group vars/tags
      hosts: {
        'web-1': { host: '192.168.1.10', options: { user: 'admin', port: 22 }, vars?, tags? },
        'db-1':  { host: 'postgres', type: 'pod' }, // type selects connector
      },
    },
  },
}, { connectors: { k8s: (h) => new MyConnector(h) } });
```

- `type` selects the connector: `ssh` (default) or `pod`. Any other type needs a factory in `connectors`; `resolveInventory` throws at resolve time otherwise. A factory receives a `ResolvedHost` (`{ name, host, type, options, vars, tags }`).
- `host` is a plain address (default: the inventory name), and the inventory key becomes the connector `name` in reporter output. `options` is passed straight into the connector constructor, so SSH `user`, `port`, `key`, `password`, and timeouts live there.
- **Vars merge** by shallow spread, precedence `inventory → group → host`; symbol keys (`Var<T>`) survive.
- **Tags** are a deduplicated union of group and host tags.
- `resolveInventory` returns a `ResolvedInventory` that creates connectors **lazily on first access** and caches them. It is `AsyncDisposable`: use `await using`, or SSH sockets leak.

## Select hosts

| Method             | Meaning                                                 |
| ------------------ | ------------------------------------------------------- |
| `getByGroup(name)` | All hosts in the group (`[]` if unknown)                |
| `getByTag(tags)`   | Union over tags, deduplicated                           |
| `getByName(name)`  | One host, or `undefined`                                |
| `getAll()`         | Everything                                              |
| `match(pattern)`   | Glob on inventory **name** only (`*` → `.*`, `?` → `.`) |

Accessors throw `ResolvedInventory has been disposed` after dispose. Every call reuses the connector cached under that name.

## Apply

```typescript
// Single host — returns { success, conn, result }; throws ApplyError when fn fails
await apply('name', connector, async (ctx) => { … });

// Many hosts — parallel batches; returns ApplyResult[]; throws past the threshold
await apply('name', hosts.getAll(), async (ctx) => { … },
  { batchSize?: 5, maxFailPercent?: 20 });
```

- `apply` opens an `apply` frame; each host gets a child `connector` frame. It calls `conn.connect(signal)` and then `fn(ctx)`.
- An `fn` error becomes `{ success: false, conn, error }` for that host and is reported through `reporter.ctxError`. A `connect()` error is **not** captured: it propagates and aborts the whole `apply`, and that host gets no result.
- `batchSize` defaults to `5`; `Infinity` runs one batch. It must be `>= 1` (or `Infinity`); `0` or a negative value never advances the loop.
- `maxFailPercent` defaults to `100`; `failLimit = ceil(n * pct / 100)`. After each batch, `failCount > failLimit` marks unprocessed hosts `{ success: false, error: 'Aborted due to max failures exceeded' }` and throws `ApplyError` (extends `AggregateError`, carries `.results`).
- Below the threshold, multi-host `apply` **returns** the mixed array without throwing, so inspect it. `maxFailPercent: 0` still lets the first batch finish before aborting (`failLimit = 0`, strict `>`).

```typescript
import { start } from 'sysopkit/start';

await start(async (ctx) => {
  try {
    const results = await apply('deploy', conns, fn, { batchSize: 5, maxFailPercent: 20 });
    for (const r of results) if (!r.success) ctx.error(`${r.conn.name}: ${r.error}`);
  } catch (e) {
    if (e instanceof ApplyError) {
      for (const r of e.results) {
        if (!r.success) ctx.error(`${r.conn.name}: ${r.error}`);
      }
    }
    throw e;
  }
});
```

## Rules

- Single and multi modes return different shapes (object vs array). Overload resolution keys on `Connector` vs `Connector[]`, so guard `getByName()` (possibly `undefined`) before passing it to single mode.
- `apply` `vars` live on the apply frame and reach `fn` and its children through the parent chain. Inventory host/group `vars` live on the connector (`conn.vars`), not in the frame chain, so `ctx.tryGet()` cannot see them. Pass `SUDO_*` and similar context vars through `start`/`apply`/`task`/`utility` `vars`.
- `match()` globs the inventory name, not the `host` address.
