import { processExec } from './process.js';

/** Union type for all GPG key variants. */
export type GpgKey = GpgPubKey | GpgFprKey | GpgUidKey;

/** Common properties shared across all GPG key types. */
export interface GpgKeyBase {
  /** Key type identifier. */
  readonly type: 'pub' | 'fpr' | 'uid';
  /** Validity status (e.g., 'u' for ultimate, 'f' for full). */
  readonly validity: string;
  /** Key length in bits. */
  readonly keyLength: string;
  /** Encryption algorithm identifier. */
  readonly algorithm: string;
  /** Short Key ID. */
  readonly keyId: string;
  /** Unix timestamp of key creation. */
  readonly creationDate: string;
  /** Unix timestamp of key expiration. */
  readonly expirationDate: string;
  /** Key capabilities (e.g., 's' for sign, 'c' for certify, 'e' for encrypt). */
  readonly capabilities: string;
}

/** A public GPG key record. */
export interface GpgPubKey extends GpgKeyBase {
  readonly type: 'pub';
  /** User identity string (e.g., "Name <email>"). */
  readonly userId: string;
}

/** A fingerprint GPG key record. */
export interface GpgFprKey extends GpgKeyBase {
  readonly type: 'fpr';
  /** Full fingerprint string. */
  readonly fingerprint: string;
}

/** A user ID GPG key record. */
export interface GpgUidKey extends GpgKeyBase {
  readonly type: 'uid';
  /** User identity string (e.g., "Name <email>"). */
  readonly userId: string;
}

/** Options for showing GPG keys. */
export interface ShowGpgKeysOptions {
  /** Path to the keyring or key file. */
  readonly path: string;
}

/**
 * Parses a colon-delimited GPG key line into a typed key object.
 *
 * Expects input in GPG's --with-colons format.
 */
export function parseGpgKey(data: string): GpgKey {
  const parts = data.split(':');
  const type = parts[0];
  switch (type) {
    case 'pub':
    case 'uid':
      return {
        type,
        validity: parts[1],
        keyLength: parts[2],
        algorithm: parts[3],
        keyId: parts[4],
        creationDate: parts[5],
        expirationDate: parts[6],
        userId: parts[9],
        capabilities: parts[11],
      };
    case 'fpr':
      return {
        type,
        validity: parts[1],
        keyLength: parts[2],
        algorithm: parts[3],
        keyId: parts[4],
        creationDate: parts[5],
        expirationDate: parts[6],
        fingerprint: parts[9],
        capabilities: parts[11],
      };
    default:
      throw new Error(`unknown key type '${type}'`);
  }
}

/**
 * Extracts GPG keys from raw key data using gpg --show-keys.
 *
 * Parses the output into typed GpgKey objects.
 */
export async function showGpgKeys(data: string): Promise<GpgKey[]> {
  const { stdout, stderr, exitCode } = await processExec(['gpg', '--show-keys', '--with-colons'], {
    stdin: data,
  });
  if (exitCode !== 0) {
    throw new Error(`failed to extract keys\n${stderr}`);
  }
  return stdout.trim().split('\n').map(parseGpgKey);
}
