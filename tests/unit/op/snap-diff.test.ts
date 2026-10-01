import { describe, expect, test } from 'bun:test';
import { parseApkDb } from '@sysopkit/linux/pkg/apk';
import { parseDpkgQuery } from '@sysopkit/linux/pkg/apt';
import { parsePacmanList } from '@sysopkit/linux/pkg/pacman';

import {
  diffVersionSnapshots,
  splitByPresence,
} from '../../../packages/@sysopkit/linux/src/pkg/snap-diff.js';

// Unit scope: snapshot parsing and snapshot diffing only (pure, no
// connector). Real install/remove behavior (idempotency, dry-run,
// round-trip) is covered in tests/e2e/ops/pkg-apt.test.ts (debian),
// tests/e2e/ops/pkg-apk.test.ts (openwrt), and
// tests/e2e/ops/pkg-pacman.test.ts (arch) with final remote state.

describe('diffVersionSnapshots', () => {
  const pkg = (name: string, version: string, arch?: string) => ({ name, version, arch });

  test('identical snapshots report no changes', () => {
    const snap = [pkg('bash', '5.2.37-1'), pkg('ed', '1.22.5-1')];
    expect(diffVersionSnapshots(snap, snap)).toEqual({ updated: [], installed: [], removed: [] });
  });

  test('new package lands in installed', () => {
    expect(
      diffVersionSnapshots([pkg('bash', '1.0')], [pkg('bash', '1.0'), pkg('ed', '2.0')]),
    ).toEqual({ updated: [], installed: ['ed'], removed: [] });
  });

  test('missing package lands in removed', () => {
    expect(
      diffVersionSnapshots([pkg('bash', '1.0'), pkg('ed', '2.0')], [pkg('bash', '1.0')]),
    ).toEqual({ updated: [], installed: [], removed: ['ed'] });
  });

  test('changed version lands in updated', () => {
    expect(diffVersionSnapshots([pkg('ed', '1.0')], [pkg('ed', '2.0')])).toEqual({
      updated: ['ed'],
      installed: [],
      removed: [],
    });
  });

  test('downgrade lands in updated', () => {
    expect(diffVersionSnapshots([pkg('ed', '2.0')], [pkg('ed', '1.0')])).toEqual({
      updated: ['ed'],
      installed: [],
      removed: [],
    });
  });

  test('arch variants are tracked independently but reported once', () => {
    const before = [pkg('foo', '1.0', 'amd64'), pkg('foo', '1.0', 'i386')];
    const after = [pkg('foo', '2.0', 'amd64'), pkg('foo', '1.0', 'i386')];
    expect(diffVersionSnapshots(before, after)).toEqual({
      updated: ['foo'],
      installed: [],
      removed: [],
    });
  });

  test('same version on a new arch lands in installed', () => {
    const before = [pkg('foo', '1.0', 'amd64')];
    const after = [pkg('foo', '1.0', 'amd64'), pkg('foo', '1.0', 'i386')];
    expect(diffVersionSnapshots(before, after)).toEqual({
      updated: [],
      installed: ['foo'],
      removed: [],
    });
  });

  test('mixed transaction groups every name once and sorts', () => {
    const before = [pkg('b-pkg', '1.0'), pkg('c-pkg', '1.0'), pkg('d-pkg', '1.0')];
    const after = [pkg('b-pkg', '2.0'), pkg('d-pkg', '1.0'), pkg('a-pkg', '1.0')];
    expect(diffVersionSnapshots(before, after)).toEqual({
      updated: ['b-pkg'],
      installed: ['a-pkg'],
      removed: ['c-pkg'],
    });
  });

  test('empty snapshots report no changes', () => {
    expect(diffVersionSnapshots([], [])).toEqual({ updated: [], installed: [], removed: [] });
  });
});

describe('splitByPresence (generic)', () => {
  test('splits by exact name', () => {
    const snap = [{ name: 'bash', version: '1.0' }];
    expect(splitByPresence(snap, ['bash', 'ed'])).toEqual({ present: ['bash'], absent: ['ed'] });
  });
});

describe('parseDpkgQuery', () => {
  test('parses name version arch rows', () => {
    expect(parseDpkgQuery('bash 5.2.37-1 amd64\ned 1.22.5-1 amd64\n')).toEqual([
      { name: 'bash', version: '5.2.37-1', arch: 'amd64' },
      { name: 'ed', version: '1.22.5-1', arch: 'amd64' },
    ]);
  });

  test('returns empty for empty output', () => {
    expect(parseDpkgQuery('')).toEqual([]);
    expect(parseDpkgQuery('  \n')).toEqual([]);
  });

  test('skips blank lines and malformed rows', () => {
    expect(parseDpkgQuery('bash 5.2.37-1\n\ned 1.22.5-1 amd64\n')).toEqual([
      { name: 'ed', version: '1.22.5-1', arch: 'amd64' },
    ]);
  });
});

describe('parsePacmanList', () => {
  test('parses name version rows', () => {
    expect(parsePacmanList('bash 5.3.3-1\ned 1.22-1\n')).toEqual([
      { name: 'bash', version: '5.3.3-1' },
      { name: 'ed', version: '1.22-1' },
    ]);
  });

  test('returns empty for empty output', () => {
    expect(parsePacmanList('')).toEqual([]);
  });

  test('skips blank lines', () => {
    expect(parsePacmanList('\nbash 5.3.3-1\n\n')).toEqual([{ name: 'bash', version: '5.3.3-1' }]);
  });
});

describe('parseApkDb', () => {
  test('parses P:/V: records', () => {
    const db = [
      'C:Q1/wFYUfQh9OqZ1Y2tmF0aPbQFcDg=',
      'P:busybox',
      'V:1.37.0-r6',
      'A:x86_64',
      'S:123',
      '',
      'C:Q1B8cftueDiOKzGPPF9PFNr+3I7hU=',
      'P:ca-bundle',
      'V:20260223-r1',
      'A:noarch',
      '',
    ].join('\n');
    expect(parseApkDb(db)).toEqual([
      { name: 'busybox', version: '1.37.0-r6' },
      { name: 'ca-bundle', version: '20260223-r1' },
    ]);
  });

  test('keeps names with spaces and dashes verbatim', () => {
    const db = [
      'C:Q1/wFYUfQh9OqZ1Y2tmF0aPbQFcDg=',
      'P:apk-mbedtls',
      'V:3.0.5-r3',
      'A:x86_64',
      '',
    ].join('\n');
    expect(parseApkDb(db)).toEqual([{ name: 'apk-mbedtls', version: '3.0.5-r3' }]);
  });

  test('ignores lowercase provides and incomplete records', () => {
    const db = [
      'P:complete',
      'V:1.0-r0',
      'p:complete=1.0-r0',
      'P:noversion',
      'A:x86_64',
      'P:next',
      'V:2.0-r0',
      '',
    ].join('\n');
    expect(parseApkDb(db)).toEqual([
      { name: 'complete', version: '1.0-r0' },
      { name: 'next', version: '2.0-r0' },
    ]);
  });

  test('returns empty for empty output', () => {
    expect(parseApkDb('')).toEqual([]);
  });
});
