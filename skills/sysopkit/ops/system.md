# System ops: users, mount, network, config serializers

## Users

```typescript
import { createGroup, createUser, deleteGroup, deleteUser } from 'sysopkit/op/users';

await createUser({ user: 'app', uid?, gid?, gecos?, home?, shell?, system?, groups? }); // groups appended via usermod -aG (must exist), never removed
await deleteUser({ user: 'app' });
await createGroup({ name: 'app', gid?, members?, system? }); // members diffed
await deleteGroup({ name: 'app' });
```

All four are **idempotent**: they diff `/etc/passwd`/`/etc/group` first (`useradd`/`usermod`, `groupadd`/`groupmod`/`gpasswd -M`) and use `diffArrays` for group members. Read-only: `getCurrentUser()` (via `id`), `parsePasswdFile`, `parseGroupFile`.

## Mount

```typescript
import { mount, umount } from 'sysopkit/op/mount';

await mount({ src: '/dev/sda1', path: '/mnt/data', fstype: 'ext4', opts?: 'defaults' });
await mount({ src: '/srv/data', path: '/mnt/data', bind: true }); // mount --bind, no -t/-o
await mount({ src: '/dev', path: '/target/dev', rslave: true }); // implies bind + --make-rslave
await mount({ src: '/dev', path: '/target/dev', rbind: true, mkdir: true }); // --mkdir --rbind, submounts propagate
await mount({ src: '/run/stub', path: '/target/etc/resolv.conf', bind: true, noCanonicalize: true }); // --no-canonicalize
await mount({ path: '/target/dev', propagation: 'rslave' }); // mount --make-rslave <path>, no src
await umount({ path: '/mnt/data' });
await umount({ path: '/target', recursive: true, lazy: true, ignoreErrors: true }); // umount -l -R ... || true
```

Idempotent. `fstype` is required unless `bind`/`rslave`/`rbind`; `src` is optional only for propagation-only remounts. Read-only: `mountInfo({ path })` (exit 64 when absent, includes `propagation`), `parseFstab`/`serializeFstab`.

Mount matching has sharp edges:

- Regular mounts match a source fuzzily (`===` or `includes` either way) and compare only the first comma-option. Unusual `opts` strings can false-positive as already mounted.
- Bind mounts ignore the findmnt source (it reports the backing device) and compare `stat -c '%d %i'` identity instead.
- The recursive `umount -R` pre-check is submount-aware, so it detaches orphaned children even when `path` itself is unmounted. `ignoreErrors` appends `2>/dev/null || true` for cleanup paths.

## Network

- `sysopkit/op/net` re-exports `./net/hosts.js`: `parseHosts`/`serializeHosts` for `/etc/hosts` (`HOSTS_PATH`). Pure functions with no apply op; write the result with `createFile`.
- Poll ports and processes with `waitUntil` ([utilities-errors](../utilities-errors.md#waituntil)): `nc -z -w 1` or bash `/dev/tcp` for ports, exact-name `pidof` for processes.

## Pure serializers

- `sysopkit/op/ssh`: `serializeSshConf(config)` for `sshd_config` (booleans → `yes`/`no`, space-strings quoted), plus `SSHD_CONF_PATH` and `KNOWN_HOSTS_PATH`.
- `sysopkit/op/ini`: `serializeIni(data)` for typed sections. No parser and no apply op.

The serializer pattern is always `serialize*` → `createFile({ path, content })` → optional service reload. OpenWrt UCI uses the separate `sysopkit-openwrt` skill.
