---
title: Clearing Orphaned Bun Cache Entries
description: A small Bash script that removes only unused extracted packages from the Bun install cache by checking hard-link counts, plus dangling symlink and empty directory cleanup.
date: 2026-09-22
authors:
  - localvoid
tags:
  - bun
  - javascript
  - disk-usage
  - tips
  - bash
excerpt: Surgical cleanup of the Bun install cache — delete extracted package directories with no remaining hard links instead of wiping the whole cache.
---

The Bun install cache accumulates every downloaded package version. By default it lives at `~/.bun/install/cache` (or `$BUN_INSTALL/install/cache` when `BUN_INSTALL` is set). Over time it grows into gigabytes of stale data from upgraded or removed dependencies. The blunt option, `bun pm cache rm`, deletes everything and forces a full re-download on the next install. The script below takes a surgical approach: it removes only extracted package directories that are no longer referenced by any `node_modules` tree.

The full script, for reference:

```bash
#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

BUN_CACHE_DIR="${BUN_CACHE_DIR:-${BUN_INSTALL:-$HOME/.bun}/install/cache}"

if [ ! -d "$BUN_CACHE_DIR" ]; then
    echo "Error: Bun cache directory not found: $BUN_CACHE_DIR" >&2
    exit 1
fi

patterns=(
    "$BUN_CACHE_DIR/*@@@*/"
    "$BUN_CACHE_DIR/@*/*@@@*/"
)

for pattern in "${patterns[@]}"; do
    # shellcheck disable=SC2086 -- intentional glob expansion
    for dir in $pattern; do
        if [ -d "$dir" ]; then
            # Count files with active hard links
            linked_files=$(find "$dir" -type f -links +1 | wc -l)

            # If no files are linked elsewhere, remove the target
            if [ "$linked_files" -eq 0 ]; then
                echo "Removing: $dir"
                rm -rf -- "$dir"
            fi
        fi
    done
done

find "$BUN_CACHE_DIR" -mindepth 1 -xtype l -delete
find "$BUN_CACHE_DIR" -mindepth 1 -type d -empty -delete
```

## Bun cache layout

The cache directory contains three kinds of entries:

- `<hash>.npm` files — registry manifest metadata (`bun-npm-manifest-cache` format: version lists and tarball URLs), keyed by content hash (for example, `009c472d14d8a98f.npm`). These are not package archives; no local tarballs are stored in the cache.
- Extracted directories — unpacked packages named `name@version@@@1` (for example, `acorn@8.18.0@@@1`). Scoped packages nest one level deeper: `@scope/name@version@@@1` (for example, `@openai/codex@0.153.4@@@1`).
- Alias symlinks — version aliases such as `oxlint/1.83.0@@@1 -> ../oxlint@1.83.0@@@1` that Bun uses to resolve version ranges.

The two glob patterns at the top of the script cover both extracted-directory shapes: `$BUN_CACHE_DIR/*@@@*/` for unscoped packages and `$BUN_CACHE_DIR/@*/*@@@*/` for scoped ones. The `.npm` manifest files match neither pattern and are left untouched, which is deliberate: all 728 of them total around 36 MB out of a 2.7 GB cache (~1.3%), and they are needed for dependency resolution. Their hash-based filenames carry no package mapping and they are never hard-linked, so the link-count check below cannot apply to them.

## Detection: hard-link counts

When Bun installs dependencies, it hard-links cache files into the project's `node_modules` instead of copying them. A cache file referenced by one project therefore has a link count of 2 — one link in the cache, one in `node_modules`. This is verifiable with `stat`:

```text
$ stat -c '%h %i %n' ~/.bun/install/cache/acorn@8.18.0@@@1/package.json
2 13703410 /home/user/.bun/install/cache/acorn@8.18.0@@@1/package.json
$ stat -c '%h %i %n' docs/node_modules/acorn/package.json
2 13703410 /home/user/docs/node_modules/acorn/package.json
```

Same inode (`13703410`), link count 2 — the two paths are the same data on disk. When every project using that version is upgraded or removed, the `node_modules` links disappear and the count drops back to 1.

That property is the entire detection mechanism:

```bash
linked_files=$(find "$dir" -type f -links +1 | wc -l)

if [ "$linked_files" -eq 0 ]; then
    echo "Removing: $dir"
    rm -rf "$dir"
fi
```

`find -links +1` lists files with more than one hard link. A count of zero means no file in that extracted directory is referenced from anywhere else, so the directory is an orphan and safe to delete. Any directory with at least one linked file is kept. Because the check is per-file rather than per-directory, a partially shared directory is never removed.

## Cleanup: dangling symlinks and empty directories

Deleting an extracted directory orphans the alias symlinks pointing at it. The first `find` pass removes them:

```bash
find "$BUN_CACHE_DIR/" -xtype l -delete
```

`-xtype l` matches symlinks whose target no longer exists (broken links), as opposed to `-type l`, which matches all symlinks. Only dangling aliases are deleted; healthy aliases pointing at still-used versions are preserved. `-mindepth 1` keeps the cache root itself out of range on both `find` passes, so the root directory can never be deleted even if it were somehow empty.

Removing directories and symlinks can leave empty parent directories behind — for example, a scope directory such as `@openai/codex/` after its last version is removed. The second pass clears those:

```bash
find "$BUN_CACHE_DIR/" -type d -empty -delete
```

## What the script leaves alone

The `.npm` manifest files are never evaluated and remain in the cache. Since the cache holds no local tarballs, reinstalling a deleted version re-downloads the archive from the registry — that network cost is why the link-count check is conservative: a directory is removed only when zero files in it are referenced from anywhere else, and anything ambiguous (for example, filenames with newlines that inflate the `wc -l` count) fails closed toward keeping the directory.

## Safety notes and limits

- The check is idempotent. Re-running the script after a cleanup finds zero candidates and changes nothing.
- `BUN_CACHE_DIR` resolves from the environment with fallbacks: an explicitly exported `BUN_CACHE_DIR` wins, otherwise `${BUN_INSTALL}/install/cache` is used when `BUN_INSTALL` is set, otherwise the Bun default `~/.bun/install/cache`. The script aborts with an error if the resolved directory does not exist, instead of running `find` against a bad path.
- `shopt -s nullglob` makes an unmatched glob expand to nothing, so a cache with no entries of one shape is handled cleanly. The `[ -d "$dir" ]` guard remains as a second layer. Filenames cannot contain spaces in this cache layout (package names plus `@@@` separators), so the intentional unquoted glob expansion is safe here.
- `rm -rf --` uses an end-of-options marker so a pathological directory name starting with `-` can never be parsed as a flag.
- The script must not run concurrently with `bun install`. A package mid-extraction has a link count of 1 and would look like an orphan.
- Deletion is irreversible outside of re-download. A dry run that lists candidates without deleting:

  ```bash
  BUN_CACHE_DIR="${BUN_CACHE_DIR:-${BUN_INSTALL:-$HOME/.bun}/install/cache}"
  for d in "$BUN_CACHE_DIR"/*@@@*/; do
      [ "$(find "$d" -type f -links +1 | wc -l)" -eq 0 ] && echo "$d"
  done
  ```

## Usage

```bash
chmod +x ~/.local/bin/bun-clear-cache
bun-clear-cache
```

The cache location is picked up from `BUN_INSTALL` automatically; override it per-run with `BUN_CACHE_DIR=/path/to/cache bun-clear-cache` when needed.

Running it after dependency upgrades or removals keeps the cache proportional to the actually installed dependency set.
