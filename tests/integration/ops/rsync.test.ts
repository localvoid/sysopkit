import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tempDir, trackChanged } from '@sysopkit/test-utils';
import { readFile, tryReadFile } from 'sysopkit/op/file';
import { rsyncPull, rsyncPush } from 'sysopkit/op/rsync';
import { sh } from 'sysopkit/op/sh';

import { remoteTempPath, sharedPodman, startSharedContainer, type Container } from '../container.js';
import { EXPECTED_FILES, RSYNC_FIXTURES, verifyRemoteFiles } from '../rsync.js';

describe('rsync ops', () => {
  let shared: Container;
  beforeAll(async () => {
    shared = await startSharedContainer({ distro: 'redhat', publishSsh: false });
  });
  afterAll(async () => {
    if (shared) await shared.stop();
  });

  test('rsyncPush syncs fixtures and is idempotent', async () => {
    await sharedPodman(shared, async () => {
      const dst = remoteTempPath('rsync-ops-push-');

      const t1 = trackChanged();
      const first = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });
      expect(t1.changed).toBe(true);
      expect(first.length).toBeGreaterThan(0);

      await verifyRemoteFiles(dst, EXPECTED_FILES);
      expect(await readFile(`${dst}/nested/deep.txt`)).toBe('nested-deep\n');

      const t2 = trackChanged();
      const second = await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });
      expect(t2.changed).toBe(false);
      expect(second).toEqual([]);
    });
  });

  test('rsyncPush reports change in dry-run without syncing', async () => {
    await sharedPodman(
      shared,
      async () => {
        const dst = remoteTempPath('rsync-ops-push-dry-');
        const t = trackChanged();
        await rsyncPush({ src: RSYNC_FIXTURES + '/', dst: dst + '/' });
        expect(t.changed).toBe(true);
        expect(await tryReadFile(`${dst}/file1.txt`)).toBeUndefined();
      },
      { dryRun: true },
    );
  });

  test('rsyncPull syncs remote tree to local dir', async () => {
    await sharedPodman(shared, async () => {
      const src = remoteTempPath('rsync-ops-pull-');
      await sh(`mkdir -p ${src}/nested`);
      await sh(`echo "content1" > ${src}/file1.txt`);
      await sh(`echo "nested content" > ${src}/nested/deep.txt`);

      await using tmp = await tempDir();
      const t = trackChanged();
      const result = await rsyncPull({ src: src + '/', dst: tmp.path + '/' });
      expect(t.changed).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      expect(await fs.readFile(join(tmp.path, 'file1.txt'), 'utf8')).toBe('content1\n');
      expect(await fs.readFile(join(tmp.path, 'nested/deep.txt'), 'utf8')).toBe(
        'nested content\n',
      );
    });
  });
});
