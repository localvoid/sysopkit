import { expect } from 'bun:test';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { exec } from 'sysopkit/op/exec';
import { $_, sh } from 'sysopkit/op/sh';

export const RSYNC_FIXTURES: string = join(import.meta.dirname, '../fixtures/rsync/src');

export interface ExpectedFile {
  path: string;
  content?: string;
  mode?: number;
  symlink?: string;
}

export const EXPECTED_FILES: ExpectedFile[] = [
  { path: 'file1.txt', content: 'content1' },
  { path: 'file2.txt', content: 'content2' },
  { path: 'executable.sh', content: 'executable', mode: 0o755 },
  { path: 'nested/deep.txt', content: 'nested-deep' },
  { path: 'subdir/item.txt', content: 'subdir-item' },
  { path: 'symlink.txt', symlink: 'file1.txt' },
];

export async function verifyLocalFiles(basePath: string, expected: ExpectedFile[]): Promise<void> {
  for (const file of expected) {
    const fullPath = join(basePath, file.path);
    const f = Bun.file(fullPath);
    const stat = await f.stat();

    if (file.content !== void 0) {
      const content = await f.text();
      expect(content.trimEnd(), `${file.path} content`).toBe(file.content);
    }

    if (file.mode !== void 0) {
      const actualMode = stat.mode & 0o777;
      expect(
        actualMode,
        `${file.path} mode should be ${file.mode.toString(8)}, got ${actualMode.toString(8)}`,
      ).toBe(file.mode);
    }

    if (file.symlink !== void 0) {
      expect(stat.isSymbolicLink(), `${file.path} should be a symlink`).toBe(true);
      const target = await fs.readlink(fullPath);
      expect(target, `${file.path} symlink target`).toBe(file.symlink);
    }
  }
}

export async function verifyRemoteFiles(basePath: string, expected: ExpectedFile[]): Promise<void> {
  const script = expected
    .map((file) => {
      const fullPath = `${basePath}/${file.path}`;
      const checks = [];

      if (file.symlink !== void 0) {
        checks.push(
          `[ -L ${$_(fullPath)} ] || { echo "Not a symlink: "${$_(file.path)} ; exit 1; }`,
        );
        checks.push(
          `[ "$(readlink ${$_(fullPath)})" = ${$_(file.symlink)} ] || { echo "Wrong symlink target: "${$_(file.path)} ; exit 1; }`,
        );
      } else {
        checks.push(
          `[ -f ${$_(fullPath)} ] || { echo "Missing file: "${$_(file.path)} ; exit 1; }`,
        );

        if (file.content !== void 0) {
          checks.push(
            `[ "$(cat ${$_(fullPath)})" = "${$_(file.content)}" ] || { echo "Content mismatch: "${$_(file.path)} ; exit 1; }`,
          );
        }

        if (file.mode !== void 0) {
          const mode = file.mode.toString(8);
          checks.push(
            `[ "$(stat -c '%a' ${$_(fullPath)})" = "${mode}" ] || { echo "Wrong mode: "${$_(file.path)} ; exit 1; }`,
          );
        }
      }
      return checks.join(' && ');
    })
    .join(' && ');

  const result = await sh(script);
  expect(result).toEqual({
    stdout: '',
    stderr: '',
    exitCode: 0,
  });
}

export async function verifyLocalFileNotExists(basePath: string, path: string): Promise<void> {
  const fullPath = join(basePath, path);
  expect(await Bun.file(fullPath).exists()).toBe(true);
}

export async function verifyRemoteFileNotExists(basePath: string, path: string): Promise<void> {
  const fullPath = `${basePath}/${path}`;
  const result = await exec(['test', '-e', fullPath]);
  expect(result.exitCode, `${path} should not exist`).not.toBe(0);
}
