# Events and change tracking

Events are branded symbols, so they cannot collide:

```typescript
type Event<T> = symbol & { __value?: T; __type?: 'sysopkit.event' };
interface ChangeEntry {
  type: string; // e.g. 'file', 'user', 'package'
  resource: string; // e.g. '/etc/nginx/nginx.conf'
  property?: string; // e.g. 'mode', 'content'
  from?: string; // omit on create; omit `to` on delete
  to?: string;
}
const CHANGE_EVENT: Event<ChangeEntry | ChangeEntry[]>;
```

```typescript
import { emit, emitChanged, onChange, latch, task } from 'sysopkit';

emitChanged({ type: 'file', resource: '/etc/foo.conf', to: 'updated' });
emit(MY_EVENT, payload); // custom events: define your own Event<T> symbol
```

- `emit(event, data)` notifies `reporter.onEvent` first, then propagates **up** the parent chain, invoking handlers at each level. It is synchronous: a handler exception bubbles into the emitter, so keep handlers trivial and non-throwing.
- Idempotent ops call `emitChanged()` only on real change, so dry-run still reports what _would_ change. Exception: `tar`/`untar` emit `packed`/`extracted` unconditionally, dry-run included. `cp`, `touchFile`, and `curl` with `path` also emit unconditionally.

## Subscribe for a scope

```typescript
import { onChange, latch } from 'sysopkit';

const restarted = latch();
await onChange(restarted, async () => {
  await task('configure', async () => {
    /* ops emitting changes */
  });
});
if (restarted()) {
  /* restart the service */
}
```

- `onChange(handler, fn)` is `utility('onChange', …)` registering on `CHANGE_EVENT` for the duration of `fn`. The subscription dies when the utility frame ends: it catches emits from **descendants of that scope** (and the scope itself), never siblings or outer scopes.
- `latch<T>()` returns `(value?: T) => boolean`. Once called with a truthy value it sticks `true`; use it directly when you only need "did anything change". A falsy payload never latches — `emitChanged` always passes an object, so only custom events can bite.
- For richer logic, pass your own `(entries) => void` and inspect `type`/`resource`/`property`.

## Rules

- Wrap the `task`s you monitor, not the code that reacts. Reacting inside the scope re-emits into the same handler.
- Handlers are synchronous with no error isolation. Filter on entry fields early so nested tasks' unrelated changes do not trigger the reaction.
- `ConsoleReporter` renders `CHANGE_EVENT` as before/after diffs. It ignores custom events; implement `Reporter.onEvent` to print them.
