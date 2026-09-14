# @sysopkit/test-utils

Dev-only test helpers for [SysopKit](https://www.sysopkit.com) operations. Private package (`private: true`) — not published to npm. Peer dependency: `sysopkit`.

## Installation

Local workspace only:

```sh
bun add -d @sysopkit/test-utils
```

## Usage

```typescript
import { MockConnector, mockSpawn, withMockContext } from '@sysopkit/test-utils';

await withMockContext(async () => {
  const conn = new MockConnector();
  mockSpawn(conn, [{ cmd: ['cat', '/etc/os-release'], stdout: 'ID=debian\n' }]);
  // run the op under test against conn
});
```

## Helpers

| Module | Exports |
| --- | --- |
| `mock` | `MockConnector`, `MockReporter`, `withMockContext`, `mockSpawn`, `getSpawnCalls`, `trackChanged` |
| `ops` | `mockReadFile`, `mockTryReadFile`, `mockReadFileMissing`, `mockWriteFile`, `mockFileExists`, `mockRm`, `mockMkdir`, `mockChmod`, `mockStat`, `mockRsync`, … |

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](../../../LICENSE-APACHE))
- MIT license ([LICENSE-MIT](../../../LICENSE-MIT))
