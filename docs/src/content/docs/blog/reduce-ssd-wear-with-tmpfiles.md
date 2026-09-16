---
title: Reducing SSD Wear with systemd-tmpfiles and tmpfs
description: Keep build outputs, caches, logs, and temp files off the SSD by placing them in tmpfs with systemd user tmpfiles.
date: 2026-09-16
authors:
  - localvoid
tags:
  - systemd
  - tmpfiles
  - tmpfs
  - ssd
  - linux
excerpt: Keep build outputs, caches, logs, and temp files in tmpfs instead of on the SSD.
---

Most of what lands on a disk every day does not need to survive a reboot: build artifacts, package caches, browser caches, logs, temp files. Moving those to `tmpfs` (`/tmp`) keeps them in memory instead of wearing out the SSD, and directories declared via user `tmpfiles.d` come back automatically at login — a reboot cleans up whatever is left.

User entries live in `~/.config/user-tmpfiles.d/*.conf`:

```text
d /tmp/build/cargo 0755 - - -
D /tmp/logs/app 0755 - - -
```

Apply without logging out:

```bash
systemd-tmpfiles --user --create
```

`d` creates the directory if missing; `D` additionally empties it on boot — suitable for build trees, unsuitable for anything with cross-boot value. See the [tmpfiles reference](/linux/systemd/tmpfiles/) for the full type list.

## Build outputs

Compilers rewrite the same files on every invocation. Point the output directory at tmpfs:

```bash
export CARGO_TARGET_DIR=/tmp/build/cargo/myproject
cargo build
```

Use one subdirectory per project to avoid lock contention. The same pattern works for `cmake -B /tmp/build/<project>`, `GOCACHE=/tmp/build/go-cache`, Jest `--cacheDirectory`, or `.pytest_cache` — the next build recreates everything, so losing the directory on reboot only costs a rebuild.

## Package manager temp and logs

Per-operation temp and log directories are never reused across boots, so they are free to move:

```text
d /tmp/pkg/npm-logs 0755 - - -
d /tmp/pkg/prebuilds 0755 - - -
```

```bash
export npm_config_cache=/tmp/pkg/npm-cache
```

Moving the full download cache saves writes but costs re-downloads after reboot — worth it on fast networks, otherwise move only the logs and temp extraction dirs.

## Browser and app caches

Browsers update disk cache, shader and GPU cache on nearly every page load. Declare the target and symlink or point the app's cache setting at it:

```text
d /tmp/cache/chromium 0700 - - -
d /tmp/cache/thumbnails 0755 - - -
```

```bash
ln -s /tmp/cache/thumbnails ~/.cache/thumbnails
```

Redirect only cache subdirectories (`Cache`, `GPUCache`, `ShaderCache`), never the whole profile — cookies and settings stay on disk. Use `0700` for paths that may hold session tokens, since `/tmp` is world-readable.

## Logs and crash dumps

Append-heavy logs that are almost never read are safe to redirect wholesale, with age-based cleanup bounding tmpfs usage:

```text
d /tmp/logs/app 0755 - - 7d -
```

The tradeoff for all of the above: tmpfs shares RAM with applications and is empty after reboot, so keep working sets comfortably below free RAM and expect a slower first build or page load after boot.
