import { join } from 'node:path';

export const CONTAINER_CACHE_DIR: string = join(import.meta.dirname, '../fixtures/container/cache');

/**
 * Test container distros. Major versions are pinned below; bump deliberately.
 */
export type TestDistro = 'fedora' | 'debian' | 'redhat' | 'arch' | 'openwrt';

export interface TestImage {
  readonly distro: TestDistro;
  /** Full podman image tag. */
  readonly image: string;
  /** Tarball filename in {@link CONTAINER_CACHE_DIR}. */
  readonly archive: string;
  /**
   * Whether the image provides the parity contract: `testuser:testpasswd`
   * with passworded sudo, sshd host keys + `testuser` authorized_keys, plus
   * `rsync`, `pgrep`, GNU `stat`, `gpg`, and `bun`.
   *
   * OpenWRT is explicitly non-parity (busybox/musl, dropbear, opkg, no sudo
   * user): suites running on it must only rely on `sh` and preinstalled
   * busybox applets.
   */
  readonly parity: boolean;
}

export const TEST_IMAGES: Record<TestDistro, TestImage> = {
  fedora: {
    distro: 'fedora',
    image: 'sysopkit-test-fedora:44',
    archive: 'sysopkit-test-fedora-44.tar',
    parity: true,
  },
  debian: {
    distro: 'debian',
    image: 'sysopkit-test-debian:13',
    archive: 'sysopkit-test-debian-13.tar',
    parity: true,
  },
  redhat: {
    distro: 'redhat',
    image: 'sysopkit-test-redhat:10',
    archive: 'sysopkit-test-redhat-10.tar',
    parity: true,
  },
  arch: {
    distro: 'arch',
    image: 'sysopkit-test-arch:base',
    archive: 'sysopkit-test-arch-base.tar',
    parity: true,
  },
  openwrt: {
    distro: 'openwrt',
    image: 'sysopkit-test-openwrt:24.10',
    archive: 'sysopkit-test-openwrt-24.10.tar',
    parity: false,
  },
};
