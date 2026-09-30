# System ops: users, mount, network, config serializers

```typescript
import { createUser, createGroup } from 'sysopkit/op/users';
import { mount, umount } from 'sysopkit/op/mount';
import { waitProcess } from 'sysopkit/op/proc';
import { parseHosts, serializeHosts } from 'sysopkit/op/net';
import { waitPort } from 'sysopkit/op/netcat';
import { serializeSshConf } from 'sysopkit/op/ssh';
import { serializeIni } from 'sysopkit/op/ini';
```

## Users (`sysopkit/op/users`)

```typescript
await createUser({ user: 'app', uid?, gid?, gecos?, home?, shell?, system?, groups? }); // groups appended via usermod -aG (must exist), never removed
await deleteUser({ user: 'app' });
await createGroup({ name: 'app', gid?, members?, system? }); // members diffed
await deleteGroup({ name: 'app' });
```

All four are **idempotent**: diff `/etc/passwd` / `/etc/group` first (`useradd`/`usermod`, `groupadd`/`groupmod`/`gpasswd -M`), `diffArrays` for group members. Read-only: `getCurrentUser()` (via `id`), `parsePasswdFile`, `parseGroupFile`.

## Mount (`sysopkit/op/mount`)

```typescript
await mount({ src: '/dev/sda1', path: '/mnt/data', fstype: 'ext4', opts?: 'defaults' });
await mount({ src: '/srv/data', path: '/mnt/data', bind: true }); // mount --bind, no -t/-o
await mount({ src: '/dev', path: '/target/dev', rslave: true }); // implies bind + --make-rslave
await mount({ src: '/dev', path: '/target/dev', rbind: true, mkdir: true }); // --mkdir --rbind, submounts propagate
await mount({ src: '/run/stub', path: '/target/etc/resolv.conf', bind: true, noCanonicalize: true }); // --no-canonicalize
await mount({ path: '/target/dev', propagation: 'rslave' }); // mount --make-rslave <path>, no src
await umount({ path: '/mnt/data' });
await umount({ path: '/target', recursive: true, lazy: true, ignoreErrors: true }); // umount -l -R ... || true
```

Idempotent. `fstype` required unless `bind`/`rslave`/`rbind`; `src` optional only for propagation-only remounts. Read-only: `mountInfo({ path })` (exit 64 when absent, includes `propagation`), `parseFstab` / `serializeFstab`.

**Pitfalls:** regular mounts match source fuzzily (`===` or `includes` either way) and compare only the first comma-option — unusual `opts` strings can false-positive as "already mounted". Bind mounts ignore findmnt source (reports backing device) and compare `stat -c '%d %i'` identity instead. Recursive `umount -R` pre-check is submount-aware (detaches orphaned children even when `path` itself is unmounted); `ignoreErrors` appends `2>/dev/null || true` for cleanup paths.

## Network and process probing

- `netcat.waitPort({ port, host?, state, delay? })` via `nc -z -w 1` (poll only; distinct from `bash.waitPort` — import explicitly).
- `proc.waitProcess({ process, state?, delay? })` via exact-name `pidof`.
- `sysopkit/op/net` (re-exports `./net/hosts.js`): `parseHosts` / `serializeHosts` for `/etc/hosts` (`HOSTS_PATH`), pure functions — no apply op; write the result with `createFile` yourself.

## Pure serializers (no transport)

- `sysopkit/op/ssh`: `serializeSshConf(config)` (`sshd_config`; booleans → `yes`/`no`, space-strings quoted) plus `SSHD_CONF_PATH`, `KNOWN_HOSTS_PATH`.
- `sysopkit/op/ini`: `serializeIni(data)` (typed sections) — no parser, no apply op.

Pattern for all serializers: `serialize*` → `createFile({ path, content })` → optional service reload. For OpenWrt UCI configs, use the separate `sysopkit-openwrt` skill.
