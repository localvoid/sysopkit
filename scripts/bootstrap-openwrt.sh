#!/usr/bin/env bash

# OpenWRT test image. Deliberately NOT parity with the fedora/debian images:
# busybox/musl rootfs, apk instead of a system package manager with our
# toolset, no sudo user, no bun. Suites running on it must only rely on `sh`
# and busybox applets.
#
# SSH: the image keeps its native dropbear server (no openssh-server).
# Host keys and root authorized_keys (shared test key) are baked in at build
# time; tests start `dropbear -R -p 22` per shared container (see
# tests/e2e/container.ts ensureSshd) and connect as root.

set -euo pipefail

OPENWRT_VERSION="25.12"
OPENWRT_PATCH="25.12.4"
BASE_IMAGE="docker.io/openwrt/rootfs:x86-64-${OPENWRT_PATCH}"
IMAGE_NAME="sysopkit-test-openwrt"
IMAGE_TAG="${OPENWRT_VERSION}"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
CACHE_DIR="tests/fixtures/container/cache"
ARCHIVE="${CACHE_DIR}/${IMAGE_NAME}-${IMAGE_TAG}.tar"

echo "=== OpenWrt ${OPENWRT_VERSION} Container Image Bootstrap (non-parity) ==="
echo "Base: ${BASE_IMAGE}"
echo "Image: ${FULL_IMAGE_NAME}"
echo "Archive: ${ARCHIVE}"
echo

mkdir -p "$CACHE_DIR"

echo "Pulling OpenWrt rootfs..."
podman pull "${BASE_IMAGE}"

echo "Running customization container..."
podman run --name openwrt-bootstrap "${BASE_IMAGE}" sh -c '
set -eu

echo "Setting hostname..."
echo "sysopkit-test" > /etc/hostname

echo "Generating dropbear host keys..."
mkdir -p /etc/dropbear
dropbearkey -t ed25519 -f /etc/dropbear/dropbear_ed25519_host_key
dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key -s 2048

echo "Authorizing shared test key for root..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKtdgnscTYVnrflUx9lbqXpEqh1B7LevKl6bZdlQkkit testuser@sysopkit-test" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

echo "Customization complete."
'

echo "Committing container to image..."
podman commit openwrt-bootstrap "${FULL_IMAGE_NAME}"

echo "Removing bootstrap container..."
podman rm openwrt-bootstrap

echo "Saving image to archive (OCI format)..."
podman save --format oci-archive -o "${ARCHIVE}" "${FULL_IMAGE_NAME}"

echo "Verifying minimal contract (sh + os-release + apk + dropbear)..."
podman run --rm "${FULL_IMAGE_NAME}" sh -c 'grep -q "ID=\"openwrt\"" /etc/os-release && grep -q "VERSION_ID=\"25.12" /etc/os-release && command -v apk >/dev/null && command -v dropbear >/dev/null && command -v dropbearkey >/dev/null && test -f /etc/dropbear/dropbear_ed25519_host_key && test -f /etc/dropbear/dropbear_rsa_host_key && test -f /root/.ssh/authorized_keys && echo "OpenWrt contract OK."'

echo "Removing image from local store..."
podman rmi "${FULL_IMAGE_NAME}" "${BASE_IMAGE}" 2>/dev/null || true

echo
echo "=== Done ==="
echo "Archive: ${ARCHIVE}"
echo "Size: $(du -h "$ARCHIVE" | cut -f1)"
