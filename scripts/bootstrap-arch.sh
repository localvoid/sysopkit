#!/usr/bin/env bash

set -euo pipefail

IMAGE_NAME="sysopkit-test-arch"
IMAGE_TAG="base"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
CACHE_DIR="tests/fixtures/container/cache"
PRIVATE_KEY="tests/fixtures/container/private_key"
ARCHIVE="${CACHE_DIR}/${IMAGE_NAME}-${IMAGE_TAG}.tar"

chmod 0600 "${PRIVATE_KEY}"

echo "=== Arch Linux Container Image Bootstrap ==="
echo "Image: ${FULL_IMAGE_NAME}"
echo "Archive: ${ARCHIVE}"
echo

mkdir -p "$CACHE_DIR"

echo "Pulling Arch Linux base image..."
podman pull "archlinux:base"

echo "Running customization container..."
podman run --name arch-bootstrap "archlinux:base" /bin/bash -c '
set -euo pipefail

echo "Installing required packages..."
pacman -Sy --noconfirm \
  sudo \
  openssh \
  shadow \
  util-linux \
  procps-ng \
  findutils \
  grep \
  sed \
  gawk \
  gnupg \
  coreutils \
  diffutils \
  tar \
  gzip \
  less \
  openbsd-netcat \
  rsync \
  curl \
  unzip
pacman -Scc --noconfirm

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
podman commit arch-bootstrap "${FULL_IMAGE_NAME}"

echo "Removing bootstrap container..."
podman rm arch-bootstrap

echo "Saving image to archive (OCI format)..."
podman save --format oci-archive -o "${ARCHIVE}" "${FULL_IMAGE_NAME}"

echo "Verifying parity contract..."
podman run --rm "${FULL_IMAGE_NAME}" /bin/bash -c '
set -euo pipefail
id testuser
groups testuser | grep -qw wheel
test -f /etc/ssh/ssh_host_ed25519_key
test -f /home/testuser/.ssh/authorized_keys
for cmd in sshd sudo rsync pgrep stat bun gpg; do command -v "$cmd" >/dev/null; done
echo "Parity contract OK."
'

echo "Removing image from local store..."
podman rmi "${FULL_IMAGE_NAME}" "archlinux:base" 2>/dev/null || true

echo
echo "=== Done ==="
echo "Archive: ${ARCHIVE}"
echo "Size: $(du -h "$ARCHIVE" | cut -f1)"
