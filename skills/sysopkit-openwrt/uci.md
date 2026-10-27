# UCI model

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

`serializeUci` emits `config <type> '<name>'` blocks with `option` and `list` lines. An anonymous section omits `name`.

Every `@sysopkit/openwrt/uci/<name>` submodule narrows this shape with a config-specific union (e.g. `UciNetwork = UciNetworkSection[]`). The submodules are **types only**; they carry no runtime code. See [configs](configs.md) for each union.

The package has no transport. Use the write-then-reload workflow in the skill entry: build the complete config, `createFile({ path: '/etc/config/<name>', content: serializeUci(config) })`, then reload the subsystem when the write changed.

## Rules

- Build the complete file. `createFile` replaces the content, so a section left out of the array is a section deleted from the device.
- Section `type` strings are the device contract. Match them exactly; an unknown type is silently ignored by the daemon.
- `serializeUci` does not validate against the device's UCI schema. Values are written verbatim and become strings on the wire.
