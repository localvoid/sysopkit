/**
 * @module pkg/rpm
 *
 * RPM package and GPG key management for Fedora/RHEL-based systems.
 *
 * RPM (RPM Package Manager) is the package manager for Fedora, RHEL, CentOS,
 * and their derivatives. This module provides operations for GPG key management
 * and RPM macro variable inspection.
 *
 * @see rpm(8) - RPM package manager
 * @see gpg(1) - OpenPGP key management
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { createFile } from 'sysopkit/op/file';
import { $_, sh } from 'sysopkit/op/sh';
import { type GpgKey, parseGpgKey, showGpgKeys } from 'sysopkit/utils/gpg';

/** RPM macro: target architecture. */
export const RPM_ARCH = '%_arch';
/** RPM macro: host CPU type. */
export const RPM_HOST_CPU = '%_host_cpu';
/** RPM macro: target OS. */
export const RPM_OS = '%_os';
/** RPM macro: vendor string. */
export const RPM_VENDOR = '%_vendor';
/** RPM macro: host triplet. */
export const RPM_HOST = '%_host';
/** RPM macro: Fedora release version. */
export const RPM_FEDORA_VERSION = '%fedora';

/**
 * Evaluates RPM macro variables.
 *
 * @param vars - RPM macro names (e.g. `"%_arch"`) to evaluate
 * @returns Array of expanded macro values, one per input
 */
export async function getRpmVars(vars: string[]): Promise<string[]> {
  const { stdout } = await sh(`rpm -e ${$_(vars.join('\n'))}`);
  return stdout.trim().split('\n');
}

/**
 * Lists all GPG keys installed in the RPM database.
 *
 * Queries the `gpg-pubkey` pseudo-package and parses the key descriptions
 * using GPG to extract key IDs and other metadata.
 */
export async function getRpmKeys(): Promise<GpgKey[]> {
  const { stdout } = await sh(
    "rpm -qa gpg-pubkey --qf '%{DESCRIPTION}' | gpg --show-keys --with-colons",
  );
  return stdout.trim().split('\n').map(parseGpgKey);
}

/**
 * Checks if a GPG key is installed in the RPM database.
 *
 * @param key - The GPG key to check (matched by key ID)
 */
export async function hasRpmKey(key: GpgKey): Promise<boolean> {
  const keys = await getRpmKeys();
  return keys.some((k) => k.keyId === key.keyId);
}

/** Options for importing a GPG key into the RPM database. */
export interface ImportRpmKeyOptions {
  /** Human-readable name for the key (used in filename). */
  readonly name: string;
  /** ASCII-armored GPG public key content. */
  readonly content: string;
}

/**
 * Imports a GPG key into the RPM database if not already present.
 *
 * Parses the key content, compares against existing keys, and writes the key
 * file to `/etc/pki/rpm-gpg/` before importing. Idempotent — skips import if
 * the key is already installed.
 */
export async function importRpmKey({ name, content }: ImportRpmKeyOptions): Promise<void> {
  await task(
    `import rpm key ${name}`,
    async (ctx) => {
      const keys = await showGpgKeys(content);
      const remoteKeys = await getRpmKeys();
      const remoteKeyIndex = new Map();
      for (const key of remoteKeys) {
        if (key.type === 'pub') {
          remoteKeyIndex.set(key.keyId, key);
        }
      }
      for (const key of keys.filter((key) => key.type === 'pub')) {
        if (remoteKeyIndex.has(key.keyId)) {
          return;
        }
      }
      const path = `/etc/pki/rpm-gpg/RPM-GPG-KEY-${name}`;
      await createFile({
        path,
        content,
        mode: 0o644,
        user: 'root',
        group: 'root',
      });
      if (!ctx.dryRun) {
        await sh(`rpm --import ${$_(path)}`);
      }
      emitChanged({
        type: 'rpm key',
        resource: name,
        property: 'imported',
      });
    },
    { verbosity: VERBOSITY_TRACE },
  );
}
