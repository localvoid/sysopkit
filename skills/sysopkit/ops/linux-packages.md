# Linux packages: apt, apk, dnf, pacman, rpm

```typescript
import { installPackages, removePackages, getInstalledPackages } from '@sysopkit/linux/pkg/apt';
import { importRpmKey, hasRpmKey } from '@sysopkit/linux/pkg/rpm';
```

Import from the `@sysopkit/linux/pkg/*` subpaths directly.

## Shape (shared by apt, apk, dnf4, dnf5, pacman)

```typescript
import { getInstalledPackages, installPackages, removePackages, updatePackages } from '@sysopkit/linux/pkg/apt';

await installPackages({ packages: ['nginx', 'curl'] });
await removePackages({ packages: ['apache2'], autoremove?: true }); // apt only
await updatePackages(); // dnf4/dnf5 only: full `dnf upgrade`, or { packages: [...] } for scoped
const pkgs = await getInstalledPackages(); // [{ name, … }]
```

- `installPackages` / `removePackages` are **idempotent** `task()` ops: query installed set first, act only on diff, `emitChanged()` (`apt:installed`, `apk:installed`, …).
- `updatePackages` (dnf4/dnf5 only) is a `task()` op returning `{ updated, installed, removed }` (+ per-group `emitChanged()`): no args = full upgrade, `packages` = scoped upgrade. Kernels land under `installed` (installonly); removals cover obsoleted pkgs. Dry-run uses `--assumeno`.
- Per-manager transports: apt uses `apt-get install [-s|-y]` (`-s` simulate in dry-run, `dpkg-query -W` for queries); apk uses `apk add -U [--simulate]` (`apk list -I` for queries, busybox-safe sh-only); dnf4/dnf5 add repo-conf types (`DnfRepoConf`) alongside the same install/remove/query trio; dnf5 also has `DnfMainConf` for the `[main]` section of `/etc/dnf/dnf.conf` (`dnf.conf(5)`), mirrored by a DNF4-specific `DnfMainConf` variant (boolean `cacheonly`, `deltarpm`/`retries`/`strict`).
- `removePackages` on apt accepts `autoremove` (`--auto-remove`).

## rpm (`@sysopkit/linux/pkg/rpm`)

Lower-level RPM database helpers, not a full installer:

```typescript
import { getRpmVars, getRpmKeys, hasRpmKey, importRpmKey } from '@sysopkit/linux/pkg/rpm';

await importRpmKey({ name, content }); // idempotent via hasRpmKey check
const keys = await getRpmKeys(); // GPG keys in the rpmdb
const arch = await getRpmVars([RPM_ARCH]); // rpm macro expansion (%_arch, %fedora, …)
```

Use `getOSInfo()` (see `linux-config.md`) to branch between managers, or pin the manager per inventory group — never probe managers at runtime with `sh('which dnf')`; query `getInstalledPackages` or gate on OS identity.
