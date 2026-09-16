---
title: Ephemeral Chrome Profiles in tmpfs
description: A Bash script and two desktop entries that run Google Chrome from a throwaway copy of a real profile stored in tmpfs — full logins and extensions, isolated writes, reduced SSD wear, and automatic cleanup.
date: 2026-09-28
authors:
  - localvoid
tags:
  - chrome
  - tmpfs
  - ssd
  - linux
  - bash
  - desktop
excerpt: Throwaway Chrome sessions with full logins and extensions — clone a real profile into tmpfs, route links to the live session, and delete everything on exit.
---

Chrome is write-heavy: shader and GPU caches, media cache, history, and session state churn on every page load. On an SSD-backed home directory that means constant small writes for data with no long-term value. Incognito mode avoids the writes but also drops logins and extensions, and a second persistent profile accumulates the same pollution as the main one.

The setup below takes a different approach: clone a real profile into `tmpfs` (`/tmp`), run Chrome there with an isolated `--user-data-dir` and `--disk-cache-dir`, and delete the copy when the window closes. Each session starts with working logins and extensions, no browsing history is written back to the SSD, and cache I/O never touches the disk.

The full script, for reference:

```bash
#!/usr/bin/bash
set -eEuo pipefail

CHROME_CONFIG_DIR="$HOME/.config/google-chrome"
if [ $# -gt 0 ]; then
    PROFILE_NAME="$1"
    shift
else
    PROFILE_NAME="Default"
fi
SOURCE_PROFILE="$CHROME_CONFIG_DIR/$PROFILE_NAME"

if [ ! -d "$SOURCE_PROFILE" ]; then
    echo "Error: Profile '$PROFILE_NAME' not found at $SOURCE_PROFILE"
    exit 1
fi

mkdir -p /tmp/google-chrome
TMP_ROOT=$(mktemp -d -p /tmp/google-chrome profile.XXXXXX)
TMP_USER_DATA="$TMP_ROOT/user-data"
TMP_DISK_CACHE="$TMP_ROOT/disk-cache"
CURRENT_LINK="/tmp/google-chrome/current"
# First running profile wins: don't steal the link from a live session.
if [[ ! -L "$CURRENT_LINK" || ! -d "$CURRENT_LINK" ]]; then
    ln -sfn "$TMP_USER_DATA" "$CURRENT_LINK"
fi

cleanup() {
    rm -rf "$TMP_ROOT"
    if [[ -L "$CURRENT_LINK" && "$(readlink "$CURRENT_LINK" || true)" == "$TMP_USER_DATA" ]]; then
        rm -f "$CURRENT_LINK"
    fi
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DISK_CACHE"
mkdir -p "$TMP_USER_DATA/Default"

cp -r "$SOURCE_PROFILE/." "$TMP_USER_DATA/Default/"

google-chrome --disk-cache-dir="$TMP_DISK_CACHE" --user-data-dir="$TMP_USER_DATA" --no-first-run "$@"
```

## Why a snapshot clone

Three options exist for a throwaway session, and only the clone preserves convenience:

- **Incognito** — clean writes, but no logins, no extensions. Every session starts from zero.
- **Second persistent profile** — keeps logins, but history, cookies, and cache accumulate permanently and still live on the SSD.
- **Snapshot clone** — copies the source profile once at launch. The session starts already logged in, with extensions enabled; all writes land in `tmpfs`, and nothing is merged back. Closing the window deletes the copy.

Logged-in state is the major advantage over Incognito. The source profile acts as a credentials store: it is opened directly only for maintenance, while everyday browsing happens in disposable clones that inherit its cookies.

## Keeping source profiles clean and lightweight

Because the whole profile is copied at every launch, the source profile should be kept small. The recommended setup is a dedicated profile per purpose (for example, one for development services, one for media): create the profile, log in to the services it needs, then clear the disk cache while keeping cookies. Clearing cache via `Delete browsing data` with only `Cached images and files` selected (time range `All time`) removes the bulky regenerable data without touching logins.

Session cookies expire. Some services, such as GitHub, require cookie revalidation roughly once a week. The refresh workflow is:

1. Launch Chrome once with the source profile directly (not the tmp script).
2. Visit the service — the session typically refreshes without showing a login screen.
3. Clear cached images and files again, keeping cookies.
4. Close the window. Subsequent tmp clones inherit the refreshed cookies.

This keeps each launch fast (small copy), each session authenticated, and the SSD free of per-session churn.

## Why tmpfs

`/tmp` is typically `tmpfs`, meaning files exist only in memory and swap:

- **No SSD wear** for cache, history, and session churn during the session.
- **Fast** cache I/O without disk latency.
- **Self-cleaning** — a reboot empties `/tmp` even if a session is killed uncleanly.

Each launch creates a fresh `profile.XXXXXX` directory with separate `user-data` and `disk-cache` subdirectories. Pointing `--disk-cache-dir` outside the user-data tree keeps evictable cache I/O isolated from profile state.

## Script walkthrough

```bash
if [ $# -gt 0 ]; then
    PROFILE_NAME="$1"
    shift
else
    PROFILE_NAME="Default"
fi
```

The first argument selects the source profile; everything after it is forwarded to Chrome via `"$@"` at the end. That forwarding is what lets desktop actions and terminal invocations pass URLs into the fresh session.

```bash
mkdir -p /tmp/google-chrome
TMP_ROOT=$(mktemp -d -p /tmp/google-chrome profile.XXXXXX)
```

`mktemp -d` creates a uniquely named session directory with `0700` permissions, which matters because the copy contains cookies and session tokens. The `mkdir -p` guards against a fresh boot where `/tmp/google-chrome` does not exist yet.

```bash
CURRENT_LINK="/tmp/google-chrome/current"
if [[ ! -L "$CURRENT_LINK" || ! -d "$CURRENT_LINK" ]]; then
    ln -sfn "$TMP_USER_DATA" "$CURRENT_LINK"
fi
```

`/tmp/google-chrome/current` points at the live session's `user-data` directory so external link openers have a stable path. The first running profile wins: a second concurrent session keeps its own directory but does not steal the link. Its cleanup only removes the symlink when the link still points at its own directory (checked with `readlink`), so closing the second session never disconnects the first.

```bash
cleanup() {
    rm -rf "$TMP_ROOT"
    ...
}
trap cleanup EXIT INT TERM
```

Exiting Chrome triggers removal of the whole session directory — profile copy, cache, and all browsing traces. There is no merge-back step by design.

## Persistent base directory with user tmpfiles

The `mkdir -p` in the script is enough for correctness, but declaring the base directory via systemd user tmpfiles makes the intent explicit and guarantees correct ownership and mode at login:

```text
# ~/.config/user-tmpfiles.d/google-chrome.conf
d /tmp/google-chrome 0700 - - -
```

Apply with `systemd-tmpfiles --user --create` (or log out and back in). The script's `mkdir -p` remains as a fallback for systems without the entry.

## Desktop integration

Two user-local desktop entries wire the script into the environment. User entries live in `~/.local/share/applications/` and override the system copies in `/usr/share/applications/`, so copy the file there first and edit the copy — package upgrades can overwrite the system one:

```bash
cp /usr/share/applications/google-chrome.desktop ~/.local/share/applications/
```

The script itself can live anywhere on `PATH`, for example `~/.local/bin/google-chrome-tmp-profile` (note that `Exec=` does not expand `~`, so the desktop file must contain the absolute path, e.g. `/home/user/.local/bin/google-chrome-tmp-profile`).

First, add a launcher action that starts a tmp session, optionally with a URL. Register the action in the main group, then define its own group:

```ini
# in ~/.local/share/applications/google-chrome.desktop
Actions=new-window;new-private-window;new-tmp;

[Desktop Action new-tmp]
Name=Temp Profile
Exec=/home/user/.local/bin/google-chrome-tmp-profile Default %U
```

The `%U` passes clicked URLs or files as extra arguments, which the script forwards to Chrome via `"$@"`. Repeat the pattern for more source profiles (e.g. a `new-tmp-work` action pointing at a `Work` profile). After editing, right-clicking the Chrome icon offers `Temp Profile` alongside the standard window actions.

Second, add a hidden default-browser shim that routes external links (from a terminal, chat app, or `xdg-open`) into the live tmp session. Save it as a separate file, e.g. `~/.local/share/applications/google-chrome-tmp-current.desktop`:

```ini
[Desktop Entry]
Type=Application
Version=1.0
Name=Google Chrome (current tmp profile)
NoDisplay=true
Terminal=false
Icon=google-chrome
MimeType=x-scheme-handler/http;x-scheme-handler/https;text/html;...
Exec=/usr/bin/bash -c 'p="/tmp/google-chrome/current"; [[ -L "$p" && -d "$p" ]] && exec "/usr/bin/google-chrome-stable" --user-data-dir="$p" "$@" || exec /usr/bin/true' bash %U
```

Then hand URL ownership to the shim:

1. Comment out the `MimeType=` line in `~/.local/share/applications/google-chrome.desktop` so the regular entry no longer claims URLs.
2. Run `update-desktop-database ~/.local/share/applications`.
3. Select the shim as the default browser (desktop settings → Default Applications, or `xdg-settings set default-web-browser google-chrome-tmp-current.desktop`).

Two details matter in the shim. The `bash -c '...' bash %U` form with `"$@"` forwards **all** URLs; using `"$0"` would deliver only the first one and drop the rest. And when no tmp session is running, the shim intentionally does nothing (`/usr/bin/true`): there is no reliable way to surface a notification from a background URL open, so silently dropping is preferable to spawning an unwanted persistent-profile window.

## Behavior summary

- Launch a tmp session from the application menu; it opens with existing logins and extensions.
- Links clicked anywhere else open as new tabs in the running tmp session via the `current` symlink.
- With no tmp session running, external links are dropped instead of leaking into a persistent profile.
- A second concurrent tmp session runs isolated but does not hijack link routing.
- Closing the session window deletes its `tmpfs` copy; a reboot clears anything left behind.
