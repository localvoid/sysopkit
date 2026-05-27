#!/usr/bin/env bash

set -euo pipefail

FEDORA_VERSION="43"
IMAGE_NAME="sysopkit-test-fedora"
IMAGE_TAG="${FEDORA_VERSION}"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
CACHE_DIR="tests/fixtures/container/cache"
PRIVATE_KEY="tests/fixtures/container/private_key"
ARCHIVE="${CACHE_DIR}/${IMAGE_NAME}-${IMAGE_TAG}.tar"

chmod 0600 "${PRIVATE_KEY}"

echo "=== Fedora ${FEDORA_VERSION} Container Image Bootstrap ==="
echo "Image: ${FULL_IMAGE_NAME}"
echo "Archive: ${ARCHIVE}"
echo

mkdir -p "$CACHE_DIR"

echo "Pulling Fedora ${FEDORA_VERSION} minimal image..."
podman pull "fedora-minimal:${FEDORA_VERSION}"

echo "Running customization container..."
podman run --name fedora-bootstrap "fedora-minimal:${FEDORA_VERSION}" /bin/bash -c '
set -euo pipefail

echo "Installing required packages..."
dnf install -y --setopt=install_weak_deps=false \
  sudo \
  openssh-server \
  shadow-utils \
  util-linux \
  procps-ng \
  findutils \
  grep \
  sed \
  gawk \
  coreutils \
  diffutils \
  tar \
  gzip \
  less \
  netcat \
  rsync \
  curl \
  unzip

echo "Configuring sudo with passwords for wheel group..."
echo "%wheel ALL=(ALL) PASSWD: ALL" > /etc/sudoers.d/02-wheel-passwd
chmod 440 /etc/sudoers.d/02-wheel-passwd

echo "Creating test user with sudo access..."
useradd -m -G wheel -s /bin/bash testuser
echo "testuser:testpasswd" | chpasswd

echo "Setting up SSH for test user..."
mkdir -p /home/testuser/.ssh
chmod 700 /home/testuser/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKtdgnscTYVnrflUx9lbqXpEqh1B7LevKl6bZdlQkkit testuser@sysopkit-test" > /home/testuser/.ssh/authorized_keys
chmod 600 /home/testuser/.ssh/authorized_keys
chown -R testuser:testuser /home/testuser/.ssh

echo "Generating SSH host keys..."
ssh-keygen -A

echo "Setting hostname..."
echo "sysopkit-test" > /etc/hostname

echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash
ln -s /root/.bun/bin/bun /usr/local/bin/bun

echo "Customization complete."
'

echo "Committing container to image..."
podman commit fedora-bootstrap "${FULL_IMAGE_NAME}"

echo "Removing bootstrap container..."
podman rm fedora-bootstrap

echo "Saving image to archive (OCI format)..."
podman save --format oci-archive -o "${ARCHIVE}" "${FULL_IMAGE_NAME}"

echo "Removing image from local store..."
podman rmi "${FULL_IMAGE_NAME}" "fedora:${FEDORA_VERSION}" 2>/dev/null || true

echo
echo "=== Done ==="
echo "Archive: ${ARCHIVE}"
echo "Size: $(du -h "$ARCHIVE" | cut -f1)"
