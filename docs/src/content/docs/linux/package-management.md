---
title: Package Management
description: APT, DNF4, DNF5, Pacman, APK, and RPM package management operations.
---

Manage packages on Debian/Ubuntu (APT), Fedora (DNF5), RHEL (DNF4), Arch Linux (pacman), and Alpine-based distros (APK), plus GPG keys in the RPM database.

## APT (Debian/Ubuntu)

```ts
import {
  getInstalledPackages,
  installPackages,
  removePackages,
  updatePackages,
} from '@sysopkit/linux/pkg/apt';
```

### getInstalledPackages()

Lists all installed packages with versions by querying the local dpkg database (`dpkg-query`, no repository metadata load).

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash', version: '5.2.37-1', arch: 'amd64' }, ...]
```

### installPackages()

Installs packages using `apt-get install`. Change detection diffs dpkg snapshots before/after the transaction. Dry-run previews compare the requested names against the snapshot without running the solver (dependencies are not enumerated, names are not validated against repositories).

```ts
await installPackages({ packages: ['nginx', 'postgresql'] });
```

### removePackages()

Removes packages using `apt-get remove`. Preserves configuration files. Pass `autoremove: true` to also remove dependencies that are no longer needed (`--auto-remove`). Change detection diffs dpkg snapshots before/after the transaction. Dry-run previews compare the requested names against the snapshot (autoremoved dependencies are not enumerated).

```ts
await removePackages({ packages: ['apache2'] });
await removePackages({ packages: ['apache2'], autoremove: true });
```

### updatePackages()

Upgrades packages using `apt-get`. Refreshes the package indexes (`apt-get update`) first, then with no `packages` (or an empty list) upgrades the whole system (`apt-get full-upgrade`, which may install new dependencies and remove obsoleted packages); otherwise upgrades only the named packages (`apt-get install --only-upgrade`, which never installs missing names). Returns the changed package names grouped by change kind (`{ updated, installed, removed }`) and emits a change event per group. Change detection diffs dpkg snapshots before/after the transaction. Dry-run previews list upgradable packages via `apt list --upgradable` and map them against the snapshot and scope (new dependencies and removals are not predicted).

```ts
const { updated, installed, removed } = await updatePackages();
await updatePackages({ packages: ['nginx'] });
```

## DNF5 (Fedora)

```ts
import {
  getInstalledPackages,
  installPackages,
  removePackages,
  updatePackages,
} from '@sysopkit/linux/pkg/dnf5';
```

### getInstalledPackages()

Lists all installed packages with detailed metadata by querying the local RPM database (`rpm -qa`, no repository metadata load).

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash', epoch: '0', version: '5.2', release: '1.fc40', arch: 'x86_64' }, ...]
```

### installPackages()

Installs packages using `dnf install`. Supports `weakDependencies` option. Change detection diffs RPM database snapshots before/after the transaction. Dry-run previews compare the requested names against the snapshot without running the solver (dependencies are not enumerated, names are not validated against repositories).

```ts
await installPackages({ packages: ['nginx'], weakDependencies: false });
```

### removePackages()

Removes packages using `dnf remove`. Unused dependencies installed for the removed packages are removed as well (DNF5 cleans requirements on remove by default). Dry-run previews compare the requested names against the snapshot (autoremoved dependencies are not enumerated).

```ts
await removePackages({ packages: ['httpd'] });
```

### updatePackages()

Upgrades packages using `dnf upgrade`. With no `packages` (or an empty list) upgrades the whole system; otherwise upgrades only the named packages. Returns the changed package names grouped by change kind (`{ updated, installed, removed }`) — kernels are installonly so a kernel update lands under `installed` — and emits a change event per group. Change detection diffs RPM database snapshots before/after the transaction. Dry-run previews list available upgrades via `repoquery --upgrades` and map them against the snapshot (obsoleted removals are not predicted).

```ts
const { updated, installed, removed } = await updatePackages();
await updatePackages({ packages: ['nginx'] });
```

### Configuration types

```ts
import type { DnfMainConf, DnfRepoConf } from '@sysopkit/linux/pkg/dnf5';
```

- `DnfRepoConf` — `.repo` files (per-repository sections).
- `DnfMainConf` — `[main]` section of `/etc/dnf/dnf.conf` (see `dnf.conf(5)`). All fields optional, INI-verbatim strings.

## DNF4 (RHEL)

```ts
import {
  getInstalledPackages,
  installPackages,
  removePackages,
  updatePackages,
} from '@sysopkit/linux/pkg/dnf4';
```

### getInstalledPackages()

Lists all installed packages with detailed metadata by querying the local RPM database (`rpm -qa`, no repository metadata load).

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash', epoch: '0', version: '5.2', release: '1.el10', arch: 'x86_64' }, ...]
```

### installPackages()

Installs packages using `dnf install`. Supports `weakDependencies` option. Change detection diffs RPM database snapshots before/after the transaction. Dry-run previews compare the requested names against the snapshot without running the solver (dependencies are not enumerated, names are not validated against repositories).

```ts
await installPackages({ packages: ['nginx'], weakDependencies: false });
```

### removePackages()

Removes packages using `dnf remove`. Unused dependencies installed for the removed packages are removed as well (DNF4 cleans requirements on remove by default). Dry-run previews compare the requested names against the snapshot (autoremoved dependencies are not enumerated).

```ts
await removePackages({ packages: ['httpd'] });
```

### updatePackages()

Upgrades packages using `dnf upgrade`. With no `packages` (or an empty list) upgrades the whole system; otherwise upgrades only the named packages. Returns the changed package names grouped by change kind (`{ updated, installed, removed }`) — kernels are installonly so a kernel update lands under `installed` — and emits a change event per group. Change detection diffs RPM database snapshots before/after the transaction. Dry-run previews list available upgrades via `repoquery --upgrades` and map them against the snapshot (obsoleted removals are not predicted).

```ts
const { updated, installed, removed } = await updatePackages();
await updatePackages({ packages: ['nginx'] });
```

### Configuration types

```ts
import type { DnfMainConf, DnfRepoConf } from '@sysopkit/linux/pkg/dnf4';
```

- `DnfRepoConf` — `.repo` files (per-repository sections).
- `DnfMainConf` — `[main]` section of `/etc/dnf/dnf.conf` (see `dnf.conf(5)`). All fields optional, INI-verbatim strings. Differs from the DNF5 variant (e.g. boolean `cacheonly`, `deltarpm`/`retries`/`strict`, extra `color_list_installed_*` keys).

## Pacman (Arch Linux)

```ts
import {
  getInstalledPackages,
  installPackages,
  removePackages,
  updatePackages,
} from '@sysopkit/linux/pkg/pacman';
```

### getInstalledPackages()

Lists all installed packages with versions using `pacman -Q`.

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash', version: '5.3.3-1' }, ...]
```

### installPackages()

Installs packages using `pacman -Sy --needed`. Refreshes the package databases as part of the install; already up-to-date packages are skipped (`--needed`), so re-running is a no-op. Change detection diffs local-database snapshots before/after the transaction. Dry-run aware (print-only preview in dry-run mode).

```ts
await installPackages({ packages: ['nginx'] });
```

### removePackages()

Removes packages using `pacman -R` (dependencies are left behind, matching `apt-get remove` semantics). Pass `autoremove: true` to also remove dependencies that are no longer needed (`-Rs`). Change detection diffs local-database snapshots before/after the transaction (print-only preview in dry-run mode).

```ts
await removePackages({ packages: ['nginx'] });
await removePackages({ packages: ['nginx'], autoremove: true });
```

### updatePackages()

Upgrades packages using `pacman`. With no `packages` (or an empty list) upgrades the whole system (`pacman -Syu`, databases refreshed as part of the run); otherwise refreshes the databases and upgrades only the requested packages that are already installed (`pacman -Sy --needed`, missing names skipped, never installed). Returns the changed package names grouped by change kind (`{ updated, installed, removed }`) and emits a change event per group. Change detection diffs local-database snapshots before/after the transaction. Dry-run previews sync the databases and list available upgrades via `pacman -Qu` mapped against the snapshot and scope (new dependencies and removals are not predicted).

```ts
const { updated, installed, removed } = await updatePackages();
await updatePackages({ packages: ['nginx'] });
```

## APK (Alpine-based)

```ts
import {
  getInstalledPackages,
  installPackages,
  removePackages,
  updatePackages,
} from '@sysopkit/linux/pkg/apk';
```

### getInstalledPackages()

Lists all installed packages with versions by reading the local apk database (`/lib/apk/db/installed`, no repository metadata load).

```ts
const packages = await getInstalledPackages();
// [{ name: 'busybox', version: '1.37.0-r6' }, ...]
```

### installPackages()

Installs packages using `apk add -U` (refreshes the package indexes as part of the install). Change detection diffs installed-database snapshots before/after the transaction. Dry-run previews compare the requested names against the snapshot without running the solver (dependencies are not enumerated, names are not validated against repositories).

```ts
await installPackages({ packages: ['nano'] });
```

### removePackages()

Removes packages using `apk del`. Dependencies that are no longer needed are purged as well. Change detection diffs installed-database snapshots before/after the transaction. Dry-run previews compare the requested names against the snapshot (autoremoved dependencies are not enumerated).

```ts
await removePackages({ packages: ['nano'] });
```

### updatePackages()

Upgrades packages using `apk`. Refreshes the package indexes (`apk update`) first, then with no `packages` (or an empty list) upgrades the whole system; otherwise upgrades only the named packages (plus needed dependencies). Returns the changed package names grouped by change kind (`{ updated, installed, removed }`) and emits a change event per group. Change detection diffs installed-database snapshots before/after the transaction. Dry-run previews list upgradable packages via `apk list --upgradable` (matched against installed names, no version parsing) and map them against the scope (new dependencies and removals are not predicted).

```ts
const { updated, installed, removed } = await updatePackages();
await updatePackages({ packages: ['nano'] });
```

## RPM

```ts
import { getRpmVars, getRpmKeys, hasRpmKey, importRpmKey } from '@sysopkit/linux/pkg/rpm';
```

### getRpmVars()

Evaluates RPM macro variables.

```ts
const [arch, os] = await getRpmVars(['%_arch', '%_os']);
// ['x86_64', 'linux']
```

### getRpmKeys()

Lists all GPG keys installed in the RPM database.

### hasRpmKey()

Checks if a specific GPG key is already imported into the RPM database.

### importRpmKey()

Imports a GPG key into the RPM database. Writes the key to `/etc/pki/rpm-gpg/` before importing. Idempotent — skips if the key is already installed.

```ts
await importRpmKey({
  name: 'docker',
  content: '-----BEGIN PGP PUBLIC KEY BLOCK-----\n...',
});
```
