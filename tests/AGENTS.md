# Tests

## Integration (`tests/integration/`)

Each test file shares long-lived containers via `beforeAll`/`afterAll` — do NOT start a fresh container per test (`withPodman`/`withSsh` are kept only for one-offs). Serial execution is assumed.

Distros are explicit: every suite picks one via `ContainerOptions.distro` (registry in `tests/integration/images.ts`, majors pinned). SSH-based suites only run on `fedora`.

```typescript
import { beforeAll, afterAll } from 'bun:test';
import {
  remoteTempPath,
  sharedPodman, // or sharedSsh / startSharedSshContainer (fedora only)
  startSharedContainer,
  type Container,
} from '../container.js';

let shared: Container;
beforeAll(async () => {
  shared = await startSharedContainer({ distro: 'debian', publishSsh: false });
});
afterAll(async () => {
  if (shared) await shared.stop();
});

test('...', async () => {
  await sharedPodman(shared, async () => {
    const dst = remoteTempPath('my-test-'); // unique remote path per test
    // ... ops ...
  });
});
```

| Distro | Image (pinned major) | Parity contract |
| --- | --- | --- |
| fedora | `sysopkit-test-fedora:44` | Yes — existing `podman`/`ssh` suites run here |
| debian | `sysopkit-test-debian:13` | Yes (`sudo` group instead of `wheel`) |
| redhat | `sysopkit-test-redhat:10` | Yes (UBI minimal + microdnf; `coreutils-single` instead of `coreutils`) |
| arch | `sysopkit-test-arch:base` | Yes (rolling `archlinux:base`, pacman) |
| openwrt | `sysopkit-test-openwrt:24.10` | **No** — busybox/musl, dropbear, opkg, no sudo user; only `sh` + applets |

Parity contract: `testuser:testpasswd` with passworded sudo, sshd host keys + `testuser` authorized_keys, plus `rsync`, `pgrep`, GNU `stat`, `bun`.

Which container to use:

- `redhat` — default for common ops (base-level support). If an op works here, it works everywhere parity.
- `debian`, `fedora`, `arch` — distro-specific ops only (e.g. `pkg/apt` on debian, `pkg/dnf` on fedora, pacman quirks on arch). Do NOT duplicate common-op suites per distro.
- `fedora` — additionally the place for latest features (newest toolchain of the parity set) and the only distro for SSH-based suites.
- `openwrt` — fully distro-specific: significantly different environment (busybox/musl, dropbear, opkg, no sudo user, no parity contract). Suites running on it must only rely on `sh` and busybox applets.

Rules:

- Remote paths must be unique per test via `remoteTempPath()` — no fixed `/tmp/...` paths (shared container = shared filesystem).
- Only containers that use SSH publish host port 2222 (`publishSsh: false` otherwise), so coexisting containers don't collide.
- SSH: start via `startSharedSshContainer({ distro: 'fedora' })` once per file (idempotent `ensureSshd` rejects non-fedora), then `sharedSsh(shared, ...)` per test with a fresh connector.
- The shared container is discarded in `afterAll`, so no per-test cleanup of remote temp paths is needed.
- Images: build with `bun run test:container:init [fedora|debian|redhat|arch|openwrt]` (see `scripts/bootstrap-<distro>.sh`); `test-integration.sh` loads every archive present in `tests/fixtures/container/cache/`.
- Adding a distro: pin the major in `images.ts`, add `scripts/bootstrap-<distro>.sh` (+ parity smoke check if parity), add the `case` entry (automatic via dispatcher), document it in the table above.

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
