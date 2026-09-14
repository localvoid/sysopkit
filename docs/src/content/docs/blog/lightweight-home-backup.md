---
title: Lightweight Home Backup with Btrfs Snapshots and Rsync
description: A small Bash script that snapshots /home with Btrfs and syncs it to an external vault drive with rsync hard-link incrementals, per-directory .rsync-filter excludes, scrub verification, and 60-day retention.
date: 2026-09-14
authors:
  - localvoid
tags:
  - backup
  - rsync
  - btrfs
  - tips
  - linux
  - bash
excerpt: A dependency-free Bash script for crash-consistent /home backups — Btrfs read-only snapshot, rsync with `--link-dest`, per-directory `.rsync-filter` excludes, Btrfs scrub, and time-based retention.
---

This post describes a lightweight script that backs up `/home` to an external vault drive with minimal moving parts. No daemon, no database, no proprietary format — just a Btrfs snapshot plus `rsync`. The result on the backup drive is a plain directory tree that can be browsed, diffed, or synced back with `rsync`.

The full script, for reference:

```bash
#!/usr/bin/bash
set -eEuo pipefail

if [ "$EUID" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

VAULT_DRIVES=("/mnt/vault/a" "/mnt/vault/b")
BTRFS_SRC_SUBVOL="/home"
BTRFS_SNAPSHOTS_PATH="/.snapshots"
RETENTION_DAYS=60
DATETIME=$(date +%Y-%m-%d_%H-%M)

BACKUP_ROOT_PATH=""

for path in "${VAULT_DRIVES[@]}"; do
    if [[ -f "${path}/.mounted" ]]; then
        BACKUP_ROOT_PATH="$path"
        break
    fi
done

if [[ -z "$BACKUP_ROOT_PATH" ]]; then
    echo "Error: No valid backup destination mounted." 1>&2
    exit 1
fi


mkdir -p "$BTRFS_SNAPSHOTS_PATH"
TMP_SNAPSHOT_PATH="$BTRFS_SNAPSHOTS_PATH/tmp-backup"
[[ -d "$TMP_SNAPSHOT_PATH" ]] && btrfs subvolume delete "$TMP_SNAPSHOT_PATH"

cleanup() {
    local exit_code=$?
    if [[ -d "${TMP_SNAPSHOT_PATH:-}" ]]; then
        echo "Cleaning up temporary snapshot: $TMP_SNAPSHOT_PATH"
        btrfs subvolume delete "$TMP_SNAPSHOT_PATH" || echo "Warning: Failed to delete $TMP_SNAPSHOT_PATH"
    fi
    exit $exit_code
}
trap cleanup EXIT SIGINT SIGTERM

echo "Creating local read-only snapshot..."
btrfs subvolume snapshot -r "$BTRFS_SRC_SUBVOL" "$TMP_SNAPSHOT_PATH"

BACKUP_PATH="$BACKUP_ROOT_PATH/backup/$DATETIME"
BACKUP_LATEST_PATH="$BACKUP_ROOT_PATH/backup/latest"

RSYNC_OPTS=(
    -aAXHS
    --delete
    --numeric-ids
    --filter=": .rsync-filter"
    --info=progress2
)

if [[ -L "$BACKUP_LATEST_PATH" ]]; then
    RSYNC_OPTS+=(--link-dest="$BACKUP_LATEST_PATH")
fi

echo "Starting backup to: $BACKUP_PATH"
mkdir -p "$BACKUP_PATH"
rsync "${RSYNC_OPTS[@]}" "$TMP_SNAPSHOT_PATH/" "$BACKUP_PATH"

(
    cd "$BACKUP_ROOT_PATH/backup"
    ln -sfn "$(basename "$BACKUP_PATH")" "latest"
)

if [[ $(findmnt -no FSTYPE -T "$BACKUP_ROOT_PATH") == "btrfs" ]]; then
    echo "Starting btrfs scrub on $BACKUP_ROOT_PATH..."
    if btrfs scrub start -B -q "$BACKUP_ROOT_PATH"; then
        echo "Scrub complete: No corruption detected on the backup drive."
    else
        echo "CRITICAL: Btrfs scrub detected errors on $BACKUP_ROOT_PATH!"
        echo "Check 'dmesg' or 'btrfs scrub status $BACKUP_ROOT_PATH' for details."
    fi
fi

echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_ROOT_PATH/backup/" -mindepth 1 -maxdepth 1 -type d -ctime +$RETENTION_DAYS -exec rm -rf {} +

echo "Backup finished"
echo "TIP: If backup drive is getting slow, run 'btrfs balance'"
```

## Backup destination selection

```bash
VAULT_DRIVES=("/mnt/vault/a" "/mnt/vault/b")
```

The script supports multiple vault mount points and picks the first one that contains `.mounted` sentinel file:

```bash
for path in "${VAULT_DRIVES[@]}"; do
    if [[ -f "${path}/.mounted" ]]; then
        BACKUP_ROOT_PATH="$path"
        break
    fi
done

if [[ -z "$BACKUP_ROOT_PATH" ]]; then
    echo "Error: No valid backup destination mounted." 1>&2
    exit 1
fi
```

The `.mounted` sentinel file is the key detail. Checking only whether `/mnt/vault/a` exists is not enough — an empty mount point directory exists even when the drive is unplugged, and a backup would then silently fill the root filesystem. Requiring a marker file that only exists on the mounted filesystem itself makes "no drive plugged in" a hard error instead of a silent disaster.

Each run creates a timestamped directory under the chosen drive:

```bash
DATETIME=$(date +%Y-%m-%d_%H-%M)
BACKUP_PATH="$BACKUP_ROOT_PATH/backup/$DATETIME"
BACKUP_LATEST_PATH="$BACKUP_ROOT_PATH/backup/latest"
```

So the layout becomes `backup/2026-09-14_10-30/`, `backup/2026-09-15_10-30/`, plus a `backup/latest` symlink pointing at the most recent one.

## Crash-consistent source: read-only Btrfs snapshot

Backing up a live `/home` directly with `rsync` races with running applications — files changing mid-transfer produce an inconsistent copy. The script freezes a point-in-time view first:

```bash
BTRFS_SRC_SUBVOL="/home"
BTRFS_SNAPSHOTS_PATH="/.snapshots"
TMP_SNAPSHOT_PATH="$BTRFS_SNAPSHOTS_PATH/tmp-backup"
```

```bash
mkdir -p "$BTRFS_SNAPSHOTS_PATH"
[[ -d "$TMP_SNAPSHOT_PATH" ]] && btrfs subvolume delete "$TMP_SNAPSHOT_PATH"
```

```bash
btrfs subvolume snapshot -r "$BTRFS_SRC_SUBVOL" "$TMP_SNAPSHOT_PATH"
```

`-r` creates a read-only snapshot, which is both a safety measure (nothing during the backup can mutate the source view) and nearly free on Btrfs — snapshot creation is instant regardless of `/home` size because blocks are shared until they diverge.

The snapshot is temporary by design. A `trap` on `EXIT`, `SIGINT`, and `SIGTERM` deletes `/.snapshots/tmp-backup` when the script finishes or is interrupted, so a `Ctrl-C` never leaves a stale snapshot behind. Only one transient snapshot ever exists; history lives on the vault drive, not in a growing pile of local snapshots.

This requires `/home` to be a Btrfs subvolume and `/.snapshots` to be writable by root.

## Transfer: rsync with hard-link incrementals

```bash
RSYNC_OPTS=(
    -aAXHS
    --delete
    --numeric-ids
    --filter=": .rsync-filter"
    --info=progress2
)

if [[ -L "$BACKUP_LATEST_PATH" ]]; then
    RSYNC_OPTS+=(--link-dest="$BACKUP_LATEST_PATH")
fi

mkdir -p "$BACKUP_PATH"
rsync "${RSYNC_OPTS[@]}" "$TMP_SNAPSHOT_PATH/" "$BACKUP_PATH"
```

What each flag preserves or controls:

- `-a` — archive mode: recursion, permissions, ownership, timestamps, symlinks, devices.
- `-A` — ACLs, `-X` — extended attributes, `-H` — hard links, `-S` — sparse files. Without these, restores subtly differ from the original (broken SELinux labels, doubled disk usage for sparse VM images, split hard-linked files).
- `--delete` — makes each timestamped copy a full mirror of the source, not an ever-growing union of deleted files.
- `--numeric-ids` — compares users/groups by UID/GID rather than name, so restores are correct even if the target system's `/etc/passwd` differs.
- `--filter=": .rsync-filter"` — per-directory merge-file excludes, covered in detail in [Filtering with per-directory `.rsync-filter` files](#filtering-with-per-directory-rsync-filter-files).
- `--info=progress2` — single overall progress line instead of per-file noise.
- `--link-dest="$BACKUP_LATEST_PATH"` — the incremental mechanism. Unchanged files are hard-linked from the previous `latest` backup instead of copied, so each timestamped directory looks like a full backup but only new or changed blocks consume space. It is only added when `latest` is actually a symlink, which keeps the very first backup (no predecessor) working without special-casing.

Note the trailing slash in `"$TMP_SNAPSHOT_PATH/"` — it syncs the _contents_ of the snapshot into `$BACKUP_PATH` rather than nesting an extra `tmp-backup` directory inside it.

After a successful transfer, `latest` is repointed:

```bash
(
    cd "$BACKUP_ROOT_PATH/backup"
    ln -sfn "$(basename "$BACKUP_PATH")" "latest"
)
```

`ln -sfn` atomically replaces the symlink target, so `latest` never dangles mid-update and `--link-dest` always has a valid reference for the next run.

## Filtering with per-directory `.rsync-filter` files

The single most effective backup-size control in this setup is not compression or deduplication — it is never copying regenerable noise in the first place. That is what this line enables:

```bash
--filter=": .rsync-filter"
```

In rsync filter syntax, the `:` prefix means _dir-merge_: before transferring the contents of every directory, rsync looks for a file named `.rsync-filter` inside it on the sending side and merges its rules into the active filter list. Key properties:

- **Distributed.** Rules live next to the files they describe instead of in one central exclude file passed on the command line. A project directory declares its own build outputs; a cache directory declares itself. Adding a new noisy tool to one directory never requires editing the backup script.
- **Inherited.** Rules from a parent directory apply to all of its subdirectories. A subdirectory can add narrower rules, which take precedence over inherited ones because newer per-directory rules are evaluated first.
- **Snapshot-aware.** Because the transfer source is the frozen snapshot at `/.snapshots/tmp-backup`, the filter files are read from the same point-in-time view as the data. A half-written exclude file cannot skew a run.
- **Transferred by default.** No `e` modifier is used, so the `.rsync-filter` files themselves are part of the backup. Each timestamped copy therefore records exactly which rules produced it, and `--delete` stays consistent against the `latest` reference.

### Rule pattern basics

Each line in a `.rsync-filter` file is a filter rule. The most common form is an exclude starting with `- `:

```text
- /node_modules/***
- /packages/*/dist
- /packages/@sysopkit/*/dist
- /tests/fixtures/container/cache/*.tar
- tsconfig.tsbuildinfo
```

These lines come from this repository's own `.rsync-filter` and illustrate the full pattern vocabulary:

- `-` marks the rule as an exclude (vs. `+` for an include).
- A leading `/` anchors the pattern to the directory containing the filter file. `/node_modules/***` excludes only the top-level `node_modules`, not a nested one deeper in the tree.
- `***` matches across directory boundaries including the directory itself — `/node_modules/***` excludes the directory and everything under it.
- `*` matches within a single path component — `/packages/*/dist` excludes the `dist` directory of every top-level package.
- No leading `/` means a floating match — `tsconfig.tsbuildinfo` excludes that filename at any depth below the filter file's directory.

The same vocabulary maps directly onto home-directory noise. Typical per-directory filter files in a `/home` tree look like this:

```text
# ~/projects/webapp/.rsync-filter
- /node_modules/***
- /dist/***
- /.vite/***
```

```text
# ~/.cache/.rsync-filter
# everything under here is regenerable
- ***
```

```text
# ~/vm/.rsync-filter
- /*.tmp
- /snapshots/***
```

Each file is small, local, and obvious to whoever owns that directory. The backup script itself stays untouched as new directories appear — placing a `.rsync-filter` file is sufficient to opt out of backup traffic.

### Interaction with `--delete` and `--link-dest`

Excluded paths are hidden from the sender's file list, so they are neither copied nor hard-linked into the new timestamped directory. With plain `--delete` (without `--delete-excluded`), files already present in older snapshots from before an exclude was added are left alone — history is immutable, which is the desired behavior — while new snapshots stop accumulating that noise. Old snapshots age out through the 60-day retention pass, so the saving compounds over time.

A practical consequence: before the first backup of a new workstation, dropping a handful of `.rsync-filter` files for caches, `node_modules`, and build outputs typically cuts the transferred volume more than any rsync flag tuning. Verifying with `rsync -n` (dry run) against a snapshot shows exactly which paths the filters remove, without touching the vault drive.

## Integrity check: Btrfs scrub of the vault drive

```bash
if [[ $(findmnt -no FSTYPE -T "$BACKUP_ROOT_PATH") == "btrfs" ]]; then
    echo "Starting btrfs scrub on $BACKUP_ROOT_PATH..."
    if btrfs scrub start -B -q "$BACKUP_ROOT_PATH"; then
        echo "Scrub complete: No corruption detected on the backup drive."
    else
        echo "CRITICAL: Btrfs scrub detected errors on $BACKUP_ROOT_PATH!"
        echo "Check 'dmesg' or 'btrfs scrub status $BACKUP_ROOT_PATH' for details."
    fi
fi
```

If the vault filesystem is Btrfs, every backup ends with a full scrub: all data and metadata checksums are re-read and verified (`-B` blocks until it finishes). This catches bit rot and a dying drive early, while older timestamped copies may still be intact. The `findmnt` guard keeps the script working when the vault drive is formatted with something else — scrub is skipped instead of failing.

## Retention: timestamped directories with time-based expiry

```bash
RETENTION_DAYS=60
find "$BACKUP_ROOT_PATH/backup/" -mindepth 1 -maxdepth 1 -type d -ctime +$RETENTION_DAYS -exec rm -rf {} +
```

Backups older than 60 days are deleted at the end of each run, keeping only top-level directories under `backup/`. Because unchanged files are hard-links shared between snapshots, deleting an old directory only frees blocks unique to it — shared blocks stay alive through their remaining links. `-ctime +60` keys off directory creation time, which matches the `DATETIME` naming scheme.

The closing hint addresses long-term Btrfs behavior on the vault drive: heavy hard-link and delete churn fragments free space over time, and an occasional `btrfs balance` compacts it when writes get slow.

## Restoring

There is no restore subcommand because there is nothing to decode — each backup is a plain tree. Restoring a single file is a plain copy out of the timestamped directory or `latest`. Restoring everything is a reverse `rsync` of the desired snapshot. Picking a dated directory instead of `latest` provides point-in-time recovery.
