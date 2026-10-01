import { describe, expect, test } from 'bun:test';

import {
  diffPackages,
  parseInstalledPackages,
  parseInstallonlyNames,
  splitByPresence,
  splitUpgradeCandidates,
} from '../../../packages/@sysopkit/linux/src/pkg/dnf-common.js';

// Unit scope: RPM snapshot parsing and snapshot diffing only (pure, no
// connector). Real install/remove/upgrade behavior (idempotency, dry-run,
// round-trip) is covered in tests/e2e/ops/pkg-dnf4.test.ts and
// tests/e2e/ops/pkg-dnf5.test.ts with final remote state.

const PKG = (name: string, version: string, release = '1.fc44', arch = 'x86_64', epoch = '0') => ({
  name,
  epoch,
  version,
  release,
  arch,
});

describe('parseInstalledPackages', () => {
  test('parses rpm -qa output and normalizes (none) epoch to 0', () => {
    expect(
      parseInstalledPackages('bash (none) 5.2.37 1.fc44 x86_64\ned 0 1.22.5 2.fc44 x86_64\n'),
    ).toEqual([PKG('bash', '5.2.37'), PKG('ed', '1.22.5', '2.fc44')]);
  });

  test('parses dnf repoquery output with numeric epochs', () => {
    expect(parseInstalledPackages('bash 0 5.2.37 1.fc44 x86_64\n')).toEqual([
      PKG('bash', '5.2.37'),
    ]);
  });

  test('returns empty for empty output', () => {
    expect(parseInstalledPackages('')).toEqual([]);
    expect(parseInstalledPackages('  \n  \n')).toEqual([]);
  });

  test('skips blank lines and malformed rows', () => {
    expect(parseInstalledPackages('bash 5.2.37\n\ned 0 1.22.5 2.fc44 x86_64\n')).toEqual([
      PKG('ed', '1.22.5', '2.fc44'),
    ]);
  });
});

describe('diffPackages', () => {
  test('identical snapshots report no changes', () => {
    const snap = [PKG('bash', '5.2.37'), PKG('ed', '1.22.5')];
    expect(diffPackages(snap, snap)).toEqual({ updated: [], installed: [], removed: [] });
  });

  test('empty before reports everything as installed', () => {
    expect(diffPackages([], [PKG('ed', '1.22.5'), PKG('jq', '1.7.1')])).toEqual({
      updated: [],
      installed: ['ed', 'jq'],
      removed: [],
    });
  });

  test('new package plus new dependency land in installed', () => {
    const before = [PKG('bash', '5.2.37')];
    const after = [PKG('bash', '5.2.37'), PKG('jq', '1.7.1'), PKG('oniguruma', '6.9.9')];
    expect(diffPackages(before, after)).toEqual({
      updated: [],
      installed: ['jq', 'oniguruma'],
      removed: [],
    });
  });

  test('missing package lands in removed', () => {
    const before = [PKG('bash', '5.2.37'), PKG('ed', '1.22.5')];
    expect(diffPackages(before, [PKG('bash', '5.2.37')])).toEqual({
      updated: [],
      installed: [],
      removed: ['ed'],
    });
  });

  test('replaced EVR lands in updated', () => {
    expect(diffPackages([PKG('ed', '1.22.5')], [PKG('ed', '1.22.6')])).toEqual({
      updated: ['ed'],
      installed: [],
      removed: [],
    });
  });

  test('downgrade lands in updated', () => {
    expect(diffPackages([PKG('ed', '1.22.6')], [PKG('ed', '1.22.5')])).toEqual({
      updated: ['ed'],
      installed: [],
      removed: [],
    });
  });

  test('retained old EVR alongside new EVR lands in installed (kernel)', () => {
    const before = [PKG('kernel', '6.14.0', '1.fc44')];
    const after = [PKG('kernel', '6.14.0', '1.fc44'), PKG('kernel', '6.15.0', '1.fc44')];
    expect(diffPackages(before, after)).toEqual({
      updated: [],
      installed: ['kernel'],
      removed: [],
    });
  });

  test('reinstall of identical EVR is a no-op', () => {
    const snap = [PKG('ed', '1.22.5', '2.fc44', 'x86_64', '0')];
    expect(diffPackages(snap, [...snap])).toEqual({ updated: [], installed: [], removed: [] });
  });

  test('multilib arches are tracked independently but reported once', () => {
    const before = [PKG('foo', '1.0', '1.fc44', 'x86_64'), PKG('foo', '1.0', '1.fc44', 'i686')];
    const after = [PKG('foo', '2.0', '1.fc44', 'x86_64'), PKG('foo', '1.0', '1.fc44', 'i686')];
    expect(diffPackages(before, after)).toEqual({
      updated: ['foo'],
      installed: [],
      removed: [],
    });
  });

  test('mixed transaction groups every name once and sorts', () => {
    const before = [PKG('b-pkg', '1.0'), PKG('c-pkg', '1.0'), PKG('d-pkg', '1.0')];
    const after = [PKG('b-pkg', '2.0'), PKG('d-pkg', '1.0'), PKG('a-pkg', '1.0')];
    expect(diffPackages(before, after)).toEqual({
      updated: ['b-pkg'],
      installed: ['a-pkg'],
      removed: ['c-pkg'],
    });
  });
});

describe('splitByPresence', () => {
  test('splits requested names by snapshot membership', () => {
    expect(splitByPresence([PKG('bash', '5.2.37'), PKG('ed', '1.22.5')], ['ed', 'jq'])).toEqual({
      present: ['ed'],
      absent: ['jq'],
    });
  });

  test('sorts and de-duplicates', () => {
    expect(splitByPresence([PKG('b-pkg', '1.0')], ['b-pkg', 'a-pkg', 'a-pkg'])).toEqual({
      present: ['b-pkg'],
      absent: ['a-pkg'],
    });
  });

  test('empty snapshot reports everything absent', () => {
    expect(splitByPresence([], ['ed'])).toEqual({ present: [], absent: ['ed'] });
  });

  test('empty request reports nothing', () => {
    expect(splitByPresence([PKG('ed', '1.22.5')], [])).toEqual({ present: [], absent: [] });
  });
});

describe('parseInstallonlyNames', () => {
  test('parses one name per line', () => {
    expect(parseInstallonlyNames('kernel\nkernel-core\nkernel-modules\n')).toEqual([
      'kernel',
      'kernel-core',
      'kernel-modules',
    ]);
  });

  test('returns empty for empty output', () => {
    expect(parseInstallonlyNames('')).toEqual([]);
    expect(parseInstallonlyNames('  \n  \n')).toEqual([]);
  });
});

describe('splitUpgradeCandidates', () => {
  const none = new Set<string>();
  const kernels = new Set(['kernel', 'kernel-core', 'kernel-modules']);

  test('empty candidates report no changes', () => {
    expect(splitUpgradeCandidates([PKG('ed', '1.22.5')], [], none)).toEqual({
      updated: [],
      installed: [],
      removed: [],
    });
  });

  test('newer EVR for installed name+arch lands in updated', () => {
    expect(splitUpgradeCandidates([PKG('ed', '1.22.5')], [PKG('ed', '1.22.6')], none)).toEqual({
      updated: ['ed'],
      installed: [],
      removed: [],
    });
  });

  test('candidate EVR already installed is skipped', () => {
    const snap = [PKG('ed', '1.22.5')];
    expect(splitUpgradeCandidates(snap, [PKG('ed', '1.22.5')], none)).toEqual({
      updated: [],
      installed: [],
      removed: [],
    });
  });

  test('candidate with no installed name+arch lands in installed', () => {
    expect(splitUpgradeCandidates([PKG('bash', '5.2.37')], [PKG('ed', '1.22.5')], none)).toEqual({
      updated: [],
      installed: ['ed'],
      removed: [],
    });
  });

  test('installonly candidate with installed name+arch lands in installed', () => {
    const snap = [PKG('kernel', '6.14.0', '1.fc44')];
    expect(splitUpgradeCandidates(snap, [PKG('kernel', '6.15.0', '1.fc44')], kernels)).toEqual({
      updated: [],
      installed: ['kernel'],
      removed: [],
    });
  });

  test('non-installonly kernel candidate lands in updated', () => {
    const snap = [PKG('kernel', '6.14.0', '1.fc44')];
    expect(splitUpgradeCandidates(snap, [PKG('kernel', '6.15.0', '1.fc44')], none)).toEqual({
      updated: ['kernel'],
      installed: [],
      removed: [],
    });
  });

  test('multilib arches split independently', () => {
    const snap = [PKG('foo', '1.0', '1.fc44', 'x86_64'), PKG('foo', '1.0', '1.fc44', 'i686')];
    const candidates = [PKG('foo', '2.0', '1.fc44', 'x86_64')];
    expect(splitUpgradeCandidates(snap, candidates, none)).toEqual({
      updated: ['foo'],
      installed: [],
      removed: [],
    });
  });

  test('removed is never predicted', () => {
    const snap = [PKG('ed', '1.22.5'), PKG('old-dep', '1.0')];
    expect(splitUpgradeCandidates(snap, [PKG('ed', '1.22.6')], none).removed).toEqual([]);
  });
});
