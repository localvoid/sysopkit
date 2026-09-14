import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { getRpmKeys, getRpmVars } from '@sysopkit/linux/pkg/rpm';

import { sharedPodman, startSharedContainer, type Container } from '../container.js';

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
});
