# Linux packages: apt, apk, dnf, pacman, rpm

Import from the `@sysopkit/linux/pkg/*` subpaths directly.

## Shared shape (apt, apk, dnf4, dnf5, pacman)

```typescript
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/linux/pkg/apt';

await installPackages({ packages: ['nginx', 'curl'] });
await removePackages({ packages: ['apache2'], autoremove?: true }); // apt only
const pkgs = await getInstalledPackages(); // [{ name, … }]
```

- `installPackages`/`removePackages` are **idempotent** `task()` ops: snapshot the installed set, run the manager command, and `emitChanged()` the diff. In dry-run they emit the predicted diff without running the manager.
- Per-manager transports: apt uses `apt-get install -y` (`dpkg-query -W` queries); apk uses `apk add -U` (`apk list -I` queries, busybox-safe sh-only); dnf4/dnf5 add repo-conf types (`DnfRepoConf`) beside the same install/remove/query trio.
- dnf5 also has `DnfMainConf` for the `[main]` section of `/etc/dnf/dnf.conf` (`dnf.conf(5)`), mirrored by a DNF4-specific variant (boolean `cacheonly`, `deltarpm`/`retries`/`strict`).
- `removePackages` on apt accepts `autoremove` (`--auto-remove`).
- Dry-run compares the installed snapshot with the requested names and emits the diff without running the solver; dependencies the solver would pull in are not predicted.

## updatePackages

Every manager exports it. The op refreshes indexes, upgrades, then diffs package-database snapshots:

```typescript
import { updatePackages } from '@sysopkit/linux/pkg/apt';

const changes = await updatePackages(); // full upgrade
await updatePackages({ packages: ['nginx'] }); // scoped to installed names
```

Returns `{ updated, installed, removed }` and emits a change per group. No `packages` means a full upgrade (`apt-get full-upgrade`, `apk upgrade`, `dnf upgrade`, `pacman -Syu`); `packages` upgrades only those already installed. Kernels on dnf are installonly, so a kernel update lands under `installed`. Dry-run uses each manager's structured preview (`apt list --upgradable`, `apk list --upgradable`, `dnf repoquery --upgrades`, `pacman -Qu`); newly pulled dependencies and removals are not predicted.

## rpm (`@sysopkit/linux/pkg/rpm`)

Lower-level RPM database helpers, not a full installer:

```typescript
import { getRpmKeys, getRpmVars, hasRpmKey, importRpmKey } from '@sysopkit/linux/pkg/rpm';

await importRpmKey({ name, content }); // idempotent via hasRpmKey check
const keys = await getRpmKeys(); // GPG keys in the rpmdb
const arch = await getRpmVars([RPM_ARCH]); // rpm macro expansion (%_arch, %fedora, …)
```

Choose the manager from `getOSInfo()` ([linux-config](linux-config.md)) or pin it per inventory group. Branch on OS identity or `getInstalledPackages()` instead of probing with `sh('which dnf')`.
