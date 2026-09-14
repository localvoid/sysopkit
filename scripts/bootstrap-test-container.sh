#!/usr/bin/env bash

# Dispatcher for test container image bootstraps.
# Usage: ./scripts/bootstrap-test-container.sh [fedora|debian|redhat|arch|openwrt]
# Defaults to fedora.

set -euo pipefail

DISTRO="${1:-fedora}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${DISTRO}" in
  fedora|debian|redhat|arch|openwrt)
    exec "${SCRIPT_DIR}/bootstrap-${DISTRO}.sh"
    ;;
  *)
    echo "Error: unknown distro '${DISTRO}'. Expected one of: fedora debian redhat arch openwrt." >&2
    exit 1
    ;;
esac
