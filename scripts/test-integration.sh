#!/usr/bin/env bash

set -euo pipefail

shopt -s nullglob
ARCHIVES=(tests/fixtures/container/cache/sysopkit-test-*.tar)
FILTER=${1:-$(find tests/integration -name '*.test.ts')}

if [[ ${#ARCHIVES[@]} -eq 0 ]]; then
  echo "Error: No test image archives found. Run 'bun run test:container:init [fedora|debian|openwrt]' first."
  exit 1
fi

echo "Loading test images..."
for archive in "${ARCHIVES[@]}"; do
  echo "  ${archive}"
  podman load -i "$archive" >/dev/null
done

cleanup() {
  echo "Removing test images..."
  podman images --format '{{.Repository}}:{{.Tag}}' | grep 'sysopkit-test-' | xargs -r podman rmi -f 2>/dev/null || true
}
trap cleanup EXIT
bun test ${FILTER}
