#!/usr/bin/env bash

set -euo pipefail

IMAGE="sysopkit-test-fedora:43"
ARCHIVE="tests/fixtures/container/cache/sysopkit-test-fedora-43.tar"
FILTER=${1:-$(find tests/integration -name '*.test.ts')}

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Error: Image archive not found. Run 'bun run test:container:init' first."
  exit 1
fi

echo "Loading test image..."
podman load -i "$ARCHIVE" >/dev/null

cleanup() {
  echo "Removing test image..."
  podman rmi -f "$IMAGE" 2>/dev/null || true
}
trap cleanup EXIT
bun test ${FILTER}
