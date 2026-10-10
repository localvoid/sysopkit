import { describe, expect, test } from 'bun:test';
import { _findFilesCmd, findFiles, parseFindFilesOutput } from 'sysopkit/op/file';

// Unit scope: find command construction and -printf output parsing
// (pure, no connector). Real search behavior (filters, depths, types,
// missing dir) is covered in tests/e2e/ops/filesystem.test.ts.

describe('_findFilesCmd', () => {
  test('renders a bare search', () => {
    expect(_findFilesCmd({ dir: '/etc/ssh' })).toBe(`find /etc/ssh -printf '%y\\0%p\\0'`);
  });

  test('quotes unsafe dir paths', () => {
    expect(_findFilesCmd({ dir: '/tmp/my dir' })).toBe(`find '/tmp/my dir' -printf '%y\\0%p\\0'`);
  });

  test('renders depth bounds', () => {
    expect(_findFilesCmd({ dir: '/x', minDepth: 1, maxDepth: 2 })).toBe(
      `find /x -mindepth 1 -maxdepth 2 -printf '%y\\0%p\\0'`,
    );
  });

  test('renders a single name glob (shell-quoted, not expanded)', () => {
    expect(_findFilesCmd({ dir: '/etc/ssh', maxDepth: 1, name: 'ssh_host_*' })).toBe(
      `find /etc/ssh -maxdepth 1 -name 'ssh_host_*' -printf '%y\\0%p\\0'`,
    );
  });

  test('ORs multiple name globs', () => {
    expect(_findFilesCmd({ dir: '/x', name: ['a*', 'b?c'] })).toBe(
      `find /x \\( -name 'a*' -o -name 'b?c' \\) -printf '%y\\0%p\\0'`,
    );
  });

  test('renders single and multiple type filters', () => {
    expect(_findFilesCmd({ dir: '/x', type: 'file' })).toBe(`find /x -type f -printf '%y\\0%p\\0'`);
    expect(_findFilesCmd({ dir: '/x', type: ['dir', 'link'] })).toBe(
      `find /x \\( -type d -o -type l \\) -printf '%y\\0%p\\0'`,
    );
  });

  test('renders symlink following before the path', () => {
    expect(_findFilesCmd({ dir: '/x', followSymlinks: true })).toBe(
      `find -L /x -printf '%y\\0%p\\0'`,
    );
  });
});

describe('parseFindFilesOutput', () => {
  test('returns [] on empty output', () => {
    expect(parseFindFilesOutput('')).toEqual([]);
  });

  test('parses type/path pairs and sorts by path', () => {
    const out = parseFindFilesOutput('d\0/b\0f\0/a x\0l\0/c\0');
    expect(out).toEqual([
      { type: 'file', path: '/a x' },
      { type: 'dir', path: '/b' },
      { type: 'link', path: '/c' },
    ]);
  });

  test('maps every %y letter', () => {
    const out = parseFindFilesOutput('s\0/s\0p\0/p\0c\0/c\0b\0/b\0');
    expect(out.map((f) => f.type).sort()).toEqual(['block', 'char', 'pipe', 'socket']);
  });

  test('throws on uneven records', () => {
    expect(() => parseFindFilesOutput('f\0/a\0d')).toThrow('malformed find output');
  });

  test('throws on unknown type letters', () => {
    expect(() => parseFindFilesOutput('q\0/a\0')).toThrow("Unknown find type 'q'");
  });
});

describe('findFiles validation', () => {
  test('refuses empty dir, bad depths, empty names, bad types', async () => {
    const cases: [Parameters<typeof findFiles>[0], RegExp][] = [
      [{ dir: '' }, /dir is required/],
      [{ dir: '/x', minDepth: -1 }, /bad minDepth/],
      [{ dir: '/x', maxDepth: 1.5 }, /bad maxDepth/],
      [{ dir: '/x', name: '' }, /must not be empty/],
      [{ dir: '/x', type: 'nope' as never }, /bad type/],
    ];
    for (const [opts, re] of cases) {
      try {
        await findFiles(opts);
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toMatch(re);
      }
    }
  });
});
