#!/usr/bin/env bash

set -euo pipefail

shopt -s nullglob
ARCHIVES=(tests/fixtures/container/cache/sysopkit-test-*.tar)
FILTER=${1:-$(find tests/e2e -name '*.test.ts')}

# Load only images missing from local storage. Images already present
# (e.g. restored from the ~/.local/share/containers cache in CI) are reused
# as-is. Images are intentionally kept in storage on exit so the next run
# (or the CI cache) can reuse them.
echo "Ensuring test images..."
if [[ ${#ARCHIVES[@]} -eq 0 ]]; then
  echo "  No archives in tests/fixtures/container/cache/; checking storage only."
else
  for archive in "${ARCHIVES[@]}"; do
    # Derive image name from archive filename (sysopkit-test-<distro>-<tag>.tar).
    base=$(basename "$archive" .tar)
    name_version=${base#sysopkit-test-}
    distro=${name_version%-*}
    tag=${name_version##*-}
    image="sysopkit-test-${distro}:${tag}"
    if podman image inspect "$image" >/dev/null 2>&1; then
      echo "  present ${image} (skip ${archive})"
    else
      echo "  loading ${archive} -> ${image}"
      podman load -i "$archive" >/dev/null
    fi
  done
fi

# Fail early with a helpful message when neither storage nor archives
# provide the required images.
if ! podman images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -q 'sysopkit-test-'; then
  echo "Error: No test images in storage. Run 'bun run test:container:init [fedora|debian|redhat|arch|openwrt]' first."
  exit 1
fi

# Files run in parallel workers; tests within a file stay serial on their
# shared container. Workers are bounded (4): unbounded parallelism bursts
# ~15 simultaneous rootless container startups, which starves podman and
# flakes execs. Timeout is raised: package installs (dnf/apt) legitimately
# take 10-30s, longer under parallel load.
bun test --parallel 4 --timeout 60000 ${FILTER}
