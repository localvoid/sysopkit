import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TempDirOptions {
  readonly prefix?: string;
}

export class TempDir implements AsyncDisposable {
  readonly prefix: string;
  private _path: string | undefined;

  constructor(options?: TempDirOptions) {
    this.prefix = options?.prefix ?? 'sysopkit-test-';
    this._path = void 0;
  }

  get path(): string {
    if (!this._path) {
      throw new Error("Temp directory isn't initialized");
    }
    return this._path;
  }

  async create(): Promise<void> {
    this._path = await mkdtemp(join(tmpdir(), this.prefix));
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this._path) {
      await rm(this._path, { recursive: true }).catch(() => {});
    }
  }
}

export async function tempDir(options?: TempDirOptions): Promise<TempDir> {
  const v = new TempDir(options);
  await v.create();
  return v;
}

export async function withTempDir<T>(
  fn: (tmpDir: string) => Promise<T>,
  options?: TempDirOptions,
): Promise<T> {
  const prefix = options?.prefix ?? 'sysopkit-test-';
  const tmpDir = await mkdtemp(join(tmpdir(), prefix));
  let shouldCleanup = true;

  try {
    return await fn(tmpDir);
  } finally {
    if (shouldCleanup) {
      await rm(tmpDir, { recursive: true }).catch(() => {});
    }
  }
}
