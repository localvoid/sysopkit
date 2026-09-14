---
title: Package Management
description: APT, DNF4, DNF5, Pacman, APK, and RPM package management operations.
---

Manage packages on Debian/Ubuntu (APT), Fedora (DNF5), RHEL (DNF4), Arch Linux (pacman), and OpenWrt 25.12+ (APK), plus GPG keys in the RPM database.

## APT (Debian/Ubuntu)

```ts
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/linux/pkg/apt';
```

### getInstalledPackages()

Lists all installed packages using `dpkg-query`.

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash' }, { name: 'curl' }, ...]
```

### installPackages()

Installs packages using `apt-get install`. Emits change events for newly installed packages. Dry-run aware (`-s` flag in dry-run mode).

```ts
await installPackages({ packages: ['nginx', 'postgresql'] });
```

### removePackages()

Removes packages using `apt-get remove`. Preserves configuration files. Pass `autoremove: true` to also remove dependencies that are no longer needed (`--auto-remove`).

```ts
await removePackages({ packages: ['apache2'] });
await removePackages({ packages: ['apache2'], autoremove: true });
```

## DNF5 (Fedora)

```ts
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/linux/pkg/dnf5';
```

### getInstalledPackages()

Lists all installed packages with detailed metadata using `dnf repoquery --installed`.

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash', epoch: '0', version: '5.2', release: '1.fc40', arch: 'x86_64' }, ...]
```

### installPackages()

Installs packages using `dnf install`. Supports `weakDependencies` option.

```ts
await installPackages({ packages: ['nginx'], weakDependencies: false });
```

### removePackages()

Removes packages using `dnf remove`. Unused dependencies installed for the removed packages are removed as well (DNF5 cleans requirements on remove by default).

```ts
await removePackages({ packages: ['httpd'] });
```

## DNF4 (RHEL)

```ts
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/linux/pkg/dnf4';
```

### getInstalledPackages()

Lists all installed packages with detailed metadata using `dnf repoquery --installed`.

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash', epoch: '0', version: '5.2', release: '1.el10', arch: 'x86_64' }, ...]
```

### installPackages()

Installs packages using `dnf install`. Supports `weakDependencies` option.

```ts
await installPackages({ packages: ['nginx'], weakDependencies: false });
```

### removePackages()

Removes packages using `dnf remove`. Unused dependencies installed for the removed packages are removed as well (DNF4 cleans requirements on remove by default).

```ts
await removePackages({ packages: ['httpd'] });
```

## Pacman (Arch Linux)

```ts
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/linux/pkg/pacman';
```

### getInstalledPackages()

Lists all installed packages with versions using `pacman -Q`.

```ts
const packages = await getInstalledPackages();
// [{ name: 'bash', version: '5.3.3-1' }, ...]
```

### installPackages()

Installs packages using `pacman -Sy --needed`. Refreshes the package databases as part of the install; already up-to-date packages are skipped (`--needed`), so re-running is a no-op. Dry-run aware (print-only preview in dry-run mode).

```ts
await installPackages({ packages: ['nginx'] });
```

### removePackages()

Removes packages using `pacman -R` (dependencies are left behind, matching `apt-get remove` semantics). Pass `autoremove: true` to also remove dependencies that are no longer needed (`-Rs`).

```ts
await removePackages({ packages: ['nginx'] });
await removePackages({ packages: ['nginx'], autoremove: true });
```

## APK (OpenWrt 25.12+)

```ts
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/openwrt/pkg/apk';
```

### getInstalledPackages()

Lists all installed packages with versions using `apk list -I`.

```ts
const packages = await getInstalledPackages();
// [{ name: 'busybox', version: '1.37.0-r6' }, ...]
```

### installPackages()

Installs packages using `apk add -U` (refreshes the package indexes as part of the install). Re-running for installed packages is a no-op. Dry-run aware (`--simulate` in dry-run mode).

```ts
await installPackages({ packages: ['nano'] });
```

### removePackages()

Removes packages using `apk del`. Dependencies that are no longer needed are purged as well.

```ts
await removePackages({ packages: ['nano'] });
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
