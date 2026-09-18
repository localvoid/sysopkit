# Events and change tracking

```typescript
import { emit, emitChanged, onChange, CHANGE_EVENT, latch } from 'sysopkit';
```

## Model

Events are branded symbols (collision-safe):

```typescript
type Event<T> = symbol & { __value?: T; __type?: 'sysopkit.event' };
interface ChangeEntry {
  type: string;       // e.g. 'file', 'user', 'package'
  resource: string;   // e.g. '/etc/nginx/nginx.conf'
  property?: string;  // e.g. 'mode', 'content'
  from?: string;      // omit on create; omit `to` on delete
  to?: string;
}
const CHANGE_EVENT: Event<ChangeEntry | ChangeEntry[]>;
```

```typescript
import { emit, emitChanged, onChange, latch, task } from 'sysopkit';

emitChanged({ type: 'file', resource: '/etc/foo.conf', to: 'updated' });
emit(MY_EVENT, payload); // custom events: define your own Event<T> symbol
```

- `emit(event, data)` notifies `reporter.onEvent` first, then propagates **up**
  the parent chain, invoking handlers registered at each level. Synchronous —
  **handler exceptions bubble into the emitter**; keep handlers trivial and
  non-throwing.
- Idempotent ops call `emitChanged()` internally only on real change, so
  dry-run still reports what *would* change. Exception: `tar`/`untar` emit
  `packed`/`extracted` unconditionally, including in dry-run.

## Scoped subscriptions

```typescript
import { onChange, latch } from 'sysopkit';

const restarted = latch();
await onChange(restarted, async () => {
  await task('configure', async () => { /* ops emitting changes */ });
});
if (restarted()) { /* restart the service */ }
```

- `onChange(handler, fn)` = `utility('onChange', …)` that registers on
  `CHANGE_EVENT` for the duration of `fn`. The subscription dies when the
  utility context ends — it only catches emits from **descendants of that
  scope** (or the scope itself), never siblings or outer scopes.
- `latch<T>()` returns `(value?: T) => boolean`: once called with a truthy
  value it sticks `true` forever. Use directly as the handler when you only
  need "did anything change". Falsy payloads never latch — `emitChanged`
  always passes an object, so this only bites custom events.
- For richer logic, pass your own `(entries) => void` and inspect
  `type`/`resource`/`property`.

## Gotchas

- Scope placement matters: wrap the `task`s you monitor, not the code that
  reacts — reacting inside the scope re-emits into the same handler.
- No async handler support; no error isolation. Filter by entry fields early
  to avoid reacting to unrelated changes in nested tasks.
- `ConsoleReporter` renders `CHANGE_EVENT` as before/after diffs; custom events
  are ignored by the default reporter (implement `Reporter.onEvent` for output).
