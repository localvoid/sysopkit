import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { getRpmKeys, getRpmVars, hasRpmKey, importRpmKey } from '@sysopkit/linux/pkg/rpm';
import { trackChanged } from '@sysopkit/test-utils';
import { exec } from 'sysopkit/op/exec';
import { $_, sh } from 'sysopkit/op/sh';
import { showGpgKeys } from 'sysopkit/utils/gpg';

import { sharedPodman, startSharedContainer, type Container } from '../container.js';

function uniqueKeyName(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`.toLowerCase();
}

/** Generates a fast ed25519 test key in the container and returns its ASCII-armored public key. */
async function generateTestKey(uid: string): Promise<string> {
  await sh(
    `gpg --batch --pinentry-mode loopback --passphrase '' --quick-generate-key ${$_(uid)} ed25519 sign never`,
  );
  const { stdout } = await sh(`gpg --armor --export ${$_(uid)}`);
  return stdout;
}

describe('pkg/rpm queries', () => {
  let fedora: Container;
  let redhat: Container;
  beforeAll(async () => {
    fedora = await startSharedContainer({ distro: 'fedora', publishSsh: false });
    redhat = await startSharedContainer({ distro: 'redhat', publishSsh: false });
  });
  afterAll(async () => {
    if (fedora) await fedora.stop();
    if (redhat) await redhat.stop();
  });

  test('getRpmVars expands macros (fedora)', async () => {
    await sharedPodman(fedora, async () => {
      const [arch] = await getRpmVars(['%_arch']);
      expect(arch.length).toBeGreaterThan(0);
    });
  });

  test('getRpmVars expands macros (redhat)', async () => {
    await sharedPodman(redhat, async () => {
      const [arch] = await getRpmVars(['%_arch']);
      expect(arch.length).toBeGreaterThan(0);
    });
  });

  test('getRpmKeys returns installed keys (fedora)', async () => {
    await sharedPodman(fedora, async () => {
      const keys = await getRpmKeys();
      // gpg --with-colons yields pub+fpr+uid records; only pub records
      // carry a keyId (fpr records carry the fingerprint instead).
      const pubs = keys.filter((k) => k.type === 'pub');
      expect(pubs.length).toBeGreaterThan(0);
      for (const k of pubs) {
        expect(k.keyId.length).toBeGreaterThan(0);
      }
    });
  });

  test('getRpmKeys returns installed keys (redhat)', async () => {
    await sharedPodman(redhat, async () => {
      const keys = await getRpmKeys();
      const pubs = keys.filter((k) => k.type === 'pub');
      expect(pubs.length).toBeGreaterThan(0);
      for (const k of pubs) {
        expect(k.keyId.length).toBeGreaterThan(0);
      }
    });
  });

  test(
    'importRpmKey imports, is idempotent, and dry-run previews (redhat)',
    async () => {
      await sharedPodman(redhat, async () => {
        const name = uniqueKeyName('tku-rpmkey-');
        const uid = `${name}@sysopkit-test`;
        const content = await generateTestKey(uid);
        const pub = (await showGpgKeys(content)).find((k) => k.type === 'pub');
        expect(pub).toBeDefined();
        if (!pub || pub.type !== 'pub') expect.unreachable();

        expect(await hasRpmKey(pub)).toBe(false);

        const t1 = trackChanged();
        await importRpmKey({ name, content });
        expect(t1.changed).toBe(true);
        expect(await hasRpmKey(pub)).toBe(true);
        expect((await exec(['test', '-f', `/etc/pki/rpm-gpg/RPM-GPG-KEY-${name}`])).exitCode).toBe(
          0,
        );

        const t2 = trackChanged();
        await importRpmKey({ name, content });
        expect(t2.changed).toBe(false);
      });
    },
    { timeout: 120000 },
  );

  test(
    'importRpmKey reports change in dry-run without importing (redhat)',
    async () => {
      await sharedPodman(
        redhat,
        async () => {
          const name = uniqueKeyName('tku-rpmkey-dry-');
          const uid = `${name}@sysopkit-test`;
          const content = await generateTestKey(uid);
          const pub = (await showGpgKeys(content)).find((k) => k.type === 'pub');
          expect(pub).toBeDefined();
          if (!pub || pub.type !== 'pub') expect.unreachable();

          const t = trackChanged();
          await importRpmKey({ name, content });
          expect(t.changed).toBe(true);
          expect(await hasRpmKey(pub)).toBe(false);
        },
        { dryRun: true },
      );
    },
    { timeout: 120000 },
  );
});
