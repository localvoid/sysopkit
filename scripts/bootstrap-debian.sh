#!/usr/bin/env bash

set -euo pipefail

DEBIAN_VERSION="13"
IMAGE_NAME="sysopkit-test-debian"
IMAGE_TAG="${DEBIAN_VERSION}"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
CACHE_DIR="tests/fixtures/container/cache"
PRIVATE_KEY="tests/fixtures/container/private_key"
ARCHIVE="${CACHE_DIR}/${IMAGE_NAME}-${IMAGE_TAG}.tar"

chmod 0600 "${PRIVATE_KEY}"

echo "=== Debian ${DEBIAN_VERSION} Container Image Bootstrap ==="
echo "Image: ${FULL_IMAGE_NAME}"
echo "Archive: ${ARCHIVE}"
echo

mkdir -p "$CACHE_DIR"

echo "Pulling Debian ${DEBIAN_VERSION} slim image..."
podman pull "debian:${DEBIAN_VERSION}-slim"

echo "Running customization container..."
podman run --name debian-bootstrap "debian:${DEBIAN_VERSION}-slim" /bin/bash -c '
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "Installing required packages..."
apt-get update
apt-get install -y --no-install-recommends \
  sudo \
  openssh-server \
  openssh-client \
  passwd \
  util-linux \
  procps \
  findutils \
  grep \
  sed \
  gawk \
  coreutils \
  diffutils \
  tar \
  gzip \
  less \
  netcat-openbsd \
  rsync \
  curl \
  ca-certificates \
  unzip
rm -rf /var/lib/apt/lists/*

echo "Configuring sudo with passwords for sudo group..."
echo "%sudo ALL=(ALL) PASSWD: ALL" > /etc/sudoers.d/02-sudo-passwd
chmod 440 /etc/sudoers.d/02-sudo-passwd

echo "Creating test user with sudo access..."
useradd -m -G sudo -s /bin/bash testuser
echo "testuser:testpasswd" | chpasswd

echo "Setting up SSH for test user..."
mkdir -p /home/testuser/.ssh
chmod 700 /home/testuser/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKtdgnscTYVnrflUx9lbqXpEqh1B7LevKl6bZdlQkkit testuser@sysopkit-test" > /home/testuser/.ssh/authorized_keys
chmod 600 /home/testuser/.ssh/authorized_keys
chown -R testuser:testuser /home/testuser/.ssh

echo "Generating SSH host keys..."
ssh-keygen -A
mkdir -p /run/sshd

echo "Setting hostname..."
echo "sysopkit-test" > /etc/hostname

echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash
ln -s /root/.bun/bin/bun /usr/local/bin/bun

echo "Customization complete."
'

echo "Committing container to image..."
podman commit debian-bootstrap "${FULL_IMAGE_NAME}"

echo "Removing bootstrap container..."
podman rm debian-bootstrap

echo "Saving image to archive (OCI format)..."
podman save --format oci-archive -o "${ARCHIVE}" "${FULL_IMAGE_NAME}"

echo "Verifying parity contract..."
podman run --rm "${FULL_IMAGE_NAME}" /bin/bash -c '
set -euo pipefail
id testuser
sudo -U testuser -l >/dev/null
test -f /etc/ssh/ssh_host_ed25519_key
test -f /home/testuser/.ssh/authorized_keys
for cmd in sshd sudo rsync pgrep stat bun; do command -v "$cmd" >/dev/null; done
echo "Parity contract OK."
'

echo "Removing image from local store..."
podman rmi "${FULL_IMAGE_NAME}" "debian:${DEBIAN_VERSION}-slim" 2>/dev/null || true

echo
echo "=== Done ==="
echo "Archive: ${ARCHIVE}"
echo "Size: $(du -h "$ARCHIVE" | cut -f1)"
