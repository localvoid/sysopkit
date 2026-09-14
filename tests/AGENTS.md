# Tests

## Policy

- **Unit** (`tests/unit/`): pure parsing/serialization (`parse*/serialize*`, no connector) and sysopkit internals (`core/*`, `start`, `inventory`, reporters, middleware arg-merging/stream logic, `retry`/`timeout`/`sleep`). Mock-based command-string assertions (`mockSpawn` `cmd` arrays, `getSpawnCalls` counts) are NOT used to verify op behavior.
- **E2E** (`tests/e2e/ops/`): everything that executes commands on a target. Assert **final remote state** via read-back ops (`readFile`, `getPathInfo`, `getFileStat`, `exec(['test', ...])`, `id`/`getent`, re-running the op for idempotency, `trackChanged()`), never generated shell strings. `wait*` polling logic stays unit-tested (slow/flaky live) with one e2e smoke per waiter.
- Daemon/privileged ops that cannot run in unprivileged containers without affecting the host (`systemctl` daemon control, `hostname`/`timezone`, kernel modules, `tuned`) stay as unit mocks + file-content assertions and are documented as excluded below.

## E2E (`tests/e2e/`)

Each test file shares long-lived containers via `beforeAll`/`afterAll` — do NOT start a fresh container per test (`withPodman`/`withSsh` are kept only for one-offs). Tests within a file run serially; files run in parallel via `bun test --parallel 4 --timeout 60000` (see `scripts/test-e2e.sh`).

Distros are explicit: every suite picks one via `ContainerOptions.distro` (registry in `tests/e2e/images.ts`, majors pinned). SSH-based suites only run on `fedora`.

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
| redhat | `sysopkit-test-redhat:10` | Yes (UBI minimal + microdnf; `coreutils-single` instead of `coreutils`; `dnf`, `nc` (nmap-ncat), `ed` installed for pkg/dnf + proc-net suites) |
| arch | `sysopkit-test-arch:base` | Yes (rolling `archlinux:base`, pacman) |
| openwrt | `sysopkit-test-openwrt:24.10` | **No** — busybox/musl, dropbear, opkg, no sudo user; only `sh` + applets |

Parity contract: `testuser:testpasswd` with passworded sudo, sshd host keys + `testuser` authorized_keys, plus `rsync`, `pgrep`, GNU `stat`, `gpg`, `bun`.

Which container to use:

- `redhat` — default for common ops (base-level support). If an op works here, it works everywhere parity.
- `debian`, `fedora`, `arch` — distro-specific ops only (e.g. `pkg/apt` on debian, `pkg/dnf` on fedora, pacman quirks on arch). Do NOT duplicate common-op suites per distro.
- `fedora` — additionally the place for latest features (newest toolchain of the parity set) and the only distro for SSH-based suites.
- `openwrt` — fully distro-specific: significantly different environment (busybox/musl, dropbear, opkg, no sudo user, no parity contract). Suites running on it must only rely on `sh` and busybox applets.

Rules:

- Remote paths must be unique per test via `remoteTempPath()` — no fixed `/tmp/...` paths (shared container = shared filesystem).
- `sharedPodman` reuses a single connected `PodmanConnector` per `Container` (`podman inspect` runs once, in `beforeAll` order on first use). Each test still gets a fresh `start()`/`apply()` context (so `dryRun` and event handlers stay per-test); do NOT create connectors per test.
- Only containers that use SSH publish container port 22 to a dynamically allocated host port (`container.sshPort`; `publishSsh: false` otherwise), so parallel files never collide.
- SSH: start via `startSharedSshContainer({ distro: 'fedora' })` once per file (idempotent `ensureSshd` rejects non-fedora), then `sharedSsh(shared, ...)` per test with a fresh connector.
- The shared container is discarded in `afterAll`, so no per-test cleanup of remote temp paths is needed.
- Images: build with `bun run test:container:init [fedora|debian|redhat|arch|openwrt]` (see `scripts/bootstrap-<distro>.sh`); `test-e2e.sh` loads only archives missing from podman storage and keeps images in storage for the `~/.local/share/containers` CI cache. Run suites with `bun run test:e2e` (`bun test --parallel`).
- Adding a distro: pin the major in `images.ts`, add `scripts/bootstrap-<distro>.sh` (+ parity smoke check if parity), add the `case` entry (automatic via dispatcher), document it in the table above.
- Privileged: only `ops/mount.test.ts` uses `startSharedContainer({ privileged: true })` for real `tmpfs` mounts. Mounts stay inside the container's mount namespace on unique `remoteTempPath()` targets — never host paths.

## Structure

```
unit/
  timers.ts # drainFakeTimers helper (native jest fake timers)
  api/
    inventory.test.ts
    start.test.ts
  core/
    apply.test.ts
    context.test.ts
  ops/
    ini.test.ts # serializeIni (pure)
    mount.test.ts # mountInfo JSON parsing + fstab parse/serialize (pure)
    sysusers.test.ts # sysusers parse/serialize round-trip (pure)
    systemd-common.test.ts # systemd paths + systemctl show parsing (pure)
    wait.test.ts # polling/retry logic (mock stimulus) + TimeoutError
  reporters/
    console.test.ts
  utils/
    retry.test.ts
    sudo.test.ts # sudo argv merging (pure command generation)
    timeout.test.ts
e2e/
  connectors/
    podman.test.ts
    ssh.test.ts
  ops/ # grouped by area, assert final remote state (no cmd-string checks)
    filesystem.test.ts # redhat: file/dir/link, sha256, tar, waitFile* smoke
    accounts.test.ts # redhat: users/groups incl. idempotency + dry-run
    proc-net.test.ts # redhat: waitProcess, bash/nc waitPort, curl
    config.test.ts # redhat: hosts/ini/sysctl/limits/tmpfiles/sysusers/sudoers/sshd round-trips
    pkg-apt.test.ts # debian: apt full install/remove of `ed`
    pkg-dnf.test.ts # fedora+redhat: dnf full install/remove of `ed`
    pkg-rpm.test.ts # fedora+redhat: rpm macro/key queries, key import round-trip
    rsync.test.ts # redhat: rsync push/pull incl. idempotency + dry-run
    system.test.ts # redhat: os/cpu/mem/disk/dmesg read ops
    mount.test.ts # redhat privileged: tmpfs mount/umount round-trip
    openwrt.test.ts # openwrt: sh + busybox file ops, uci round-trip
```

Excluded from live testing (unit mocks + file-content assertions only): `systemd` daemon control (`enable/start/stop`, `daemonReload`), `setHostname` / `setTimezone` / `setLocale`, `journal` read/vacuum (needs a running journal), kernel module / `kexec`, `tuned` (needs daemon), `arch` pacman (no op module). Rationale: no systemd PID1 / host kernel in containers; mutating host identity from tests is out of scope.

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

### Temp Directories

Use the native `mkdtempDisposable` — it auto-cleans on block exit. No helper needed.

```typescript
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';

// Automatically unlinked when this block exits
await using tmp = await fs.mkdtempDisposable(join(os.tmpdir(), 'sysopkit-test-'));
// use tmp.path...
```

### Fake Timers

Use `jest.useFakeTimers()` from `bun:test` directly. Restore real timers in `afterEach` so a failing test can't leak fake time into other tests. To drain timers scheduled from promise continuations (retry delays, polling loops), use the shared `drainFakeTimers()` helper in `tests/unit/timers.ts` — the synchronous `jest.runAllTimers()` returns early when no timer is pending yet at call time.

```typescript
import { afterEach, jest } from 'bun:test';
import { drainFakeTimers } from '../timers.js';

afterEach(() => {
  jest.useRealTimers();
});

jest.useFakeTimers({ now: 0 });
await drainFakeTimers(); // advance all pending timers
jest.advanceTimersByTime(1000); // advance by ms
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
