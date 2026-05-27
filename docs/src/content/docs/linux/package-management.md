---
title: Package Management
description: APT, DNF, and RPM package management operations.
---

Operations for managing packages on Debian/Ubuntu (APT), Fedora/RHEL (DNF), and RPM GPG key management.

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

Removes packages using `apt-get remove`. Preserves configuration files.

```ts
await removePackages({ packages: ['apache2'] });
```

## DNF (Fedora/RHEL)

```ts
import { getInstalledPackages, installPackages, removePackages } from '@sysopkit/linux/pkg/dnf';
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

Removes packages using `dnf remove`.

```ts
await removePackages({ packages: ['httpd'] });
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
