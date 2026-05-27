# Tests

## Structure

```
unit/
  api/
    inventory.test.ts
    start.test.ts
  core/
    apply.test.ts
    context.test.ts
  ops/
    hash.test.ts
    ini.test.ts
    mount.test.ts
    users.test.ts
    wait.test.ts
  reporters/
    console.test.ts
  utils/
    retry.test.ts
    sudo.test.ts
    timeout.test.ts
```

### Mock Helpers

```typescript
import {
  MockConnector,
  MockReporter,
  withMockContext,
  mockSpawn,
  getSpawnCalls,
  trackChanged,
} from '@sysopkit/test-utils';

await withMockContext(async (mock) => {
  // mock.ctx - ExecutionContext
  // mock.connector - MockConnector instance
  // mock.reporter - MockReporter instance
  // mock.abortController - AbortController
});

await withMockContext(
  async (mock) => {
    // ...
  },
  { dryRun: true, vars: { key: 'value' } },
);

// Auto-verified commands
mockSpawn(mock.connector, [
  { cmd: ['rpm', '-qa', '--queryformat', '%{NAME}\n'], stdout: 'bash\nnginx\n' },
  { cmd: ['dnf', 'install', '-y', 'nginx'] },
]);

// Track change events
const tracker = trackChanged();
// ... operation ...
expect(tracker.changed).toBe(true);
```

### MockSpawnSpec

```typescript
interface MockSpawnSpec {
  readonly cmd: string[];
  readonly stdin?: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}
```

### Temp Directory Helper

```typescript
import { TempDir, tempDir, withTempDir } from 'sysopkit/test-utils';

await withTempDir(async (tmpDir) => {
  // use tmpDir...
}); // cleanup guaranteed

const tmp = await tempDir({ prefix: 'my-test-' });
// use tmp.path...
await tmp[Symbol.asyncDispose](); // cleanup
```

### Fake Timers

```typescript
import { fakeTimers, FakeTimers } from 'sysopkit/test-utils';

using timers = fakeTimers();
// or
using timers = fakeTimers(Date.now());

await timers.advanceAll(); // advance all pending timers
await timers.advanceByTime(1000); // advance by ms
```

## Testing Utilities

### Promise Rejections

Avoid `await expect(fn()).rejects.toThrow()` (known issues in Bun #5602). Use try/catch:

```typescript
try {
  await fn();
  expect.unreachable();
} catch (e) {
  expect((e as Error).message).toContain('error');
}
```

### Promise Resolutions

```typescript
await fn();
// or
const result = await fn();
expect(result).toBe(expectedValue);
```

### Other Utilities

```typescript
expect.unreachable(); // Mark unreachable code paths

expect.fail('message'); // Explicit test failure
```
