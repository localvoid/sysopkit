import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { apply, type ApplyResult, type ExecutionContext } from 'sysopkit';
import { PodmanConnector } from 'sysopkit/connector/podman';
import { SSHConnector } from 'sysopkit/connector/ssh';
import { type ExecResult } from 'sysopkit/op/exec';
import { start } from 'sysopkit/start';

export interface ContainerOptions {
  readonly user?: string;
  readonly dryRun?: boolean;
}

export const CONTAINER_FIXTURES_DIR: string = join(import.meta.dirname, '../fixtures/container');
const IMAGE_NAME = 'sysopkit-test-fedora:43';
const PRIVATE_KEY_PATH = join(CONTAINER_FIXTURES_DIR, 'private_key');
const SSH_PORT = 2222;

async function checkImageLoaded(): Promise<void> {
  const exitCode = await Bun.spawn(['podman', 'image', 'inspect', IMAGE_NAME]).exited;
  if (exitCode !== 0) {
    throw new Error(
      `Image '${IMAGE_NAME}' not found. Run tests via 'just test' which handles image loading.`,
    );
  }
}

export class Container {
  readonly name: string;
  readonly user: string | undefined;
  readonly ports: Record<number, number> | undefined;
  private started = false;

  constructor(options?: ContainerOptions) {
    this.name = `sysopkit-test-${randomUUID().slice(0, 8)}`;
    this.user = options?.user;
    this.ports = { [2222]: 22 };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await checkImageLoaded();

    const args = [
      'podman',
      'run',
      '-d',
      '--rm',
      '--name',
      this.name,
      '--hostname',
      'sysopkit-test',
    ];
    if (this.user) {
      args.push('--user', this.user);
    }

    if (this.ports) {
      for (const [hostPort, containerPort] of Object.entries(this.ports)) {
        args.push('-p', `${hostPort}:${containerPort}`);
      }
    }

    args.push(IMAGE_NAME, '/bin/sh', '-c', "trap 'exit 0' TERM; tail -f /dev/null & wait $!");

    const proc = Bun.spawn(args, { stderr: 'pipe' });
    const [exitCode, stderr] = await Promise.all([proc.exited, proc.stderr.text()]);
    if (exitCode !== 0) {
      throw new Error(`Failed to start container: ${stderr}`);
    }

    await this.waitForReady();
    this.started = true;
  }

  private async waitForReady(timeout = 3000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = await this.exec(['sh', '-c', 'exit 0']);
      if (result.exitCode === 0) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Container start timeout');
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    try {
      await Bun.spawn(['podman', 'rm', '-f', '-t', '5', this.name]).exited;
    } catch {
      // Container may have already stopped
    }

    this.started = false;
  }

  async pause(): Promise<void> {
    if (!this.started) return;
    await Bun.spawn(['podman', 'pause', this.name]).exited;
  }

  async inspect(format: string): Promise<ExecResult> {
    const proc = Bun.spawn(['podman', 'inspect', this.name, '--format', format], {
      stderr: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      proc.stdout.text(),
      proc.stderr.text(),
    ]);
    return { exitCode, stdout, stderr };
  }

  async exec(cmd: string[], options?: { user?: string }): Promise<ExecResult> {
    const args = ['podman', 'exec'];

    if (options?.user) {
      args.push('-u', options.user);
    }

    args.push(this.name, ...cmd);

    const proc = Bun.spawn(args, {
      stderr: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      proc.stdout.text(),
      proc.stderr.text(),
    ]);
    return { exitCode, stdout, stderr };
  }
}

export interface ContainerTestContext {
  container: Container;
}

export async function withContainer<R>(
  fn: (ctx: ContainerTestContext) => Promise<R>,
  options?: ContainerOptions,
): Promise<R> {
  const container = new Container(options);

  try {
    await container.start();
    const result = await start(
      async () => {
        return await fn({
          container,
        });
      },
      { dryRun: options?.dryRun },
    );
    if (result.success) {
      return result.result;
    }
    throw result.error;
  } finally {
    await container.stop();
  }
}

export async function withPodman<R>(
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: ContainerOptions,
): Promise<ApplyResult<R>> {
  return await withContainer(async ({ container }) => {
    const conn = new PodmanConnector({
      name: `podman-${container.name}`,
      host: container.name,
    });
    return await apply('test', conn, fn, { vars: { container } });
  }, options);
}

export async function withSsh<R>(
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: ContainerOptions,
): Promise<ApplyResult<R>> {
  return await withContainer(async ({ container }) => {
    await container.exec(['sh', '-c', 'nohup /usr/sbin/sshd > /dev/null 2>&1 &']);
    const exitCode = await Bun.spawn([
      'bash',
      '-c',
      `for i in {1..20}; do (echo > /dev/tcp/127.0.0.1/${SSH_PORT}) >/dev/null 2>&1 && break || sleep 0.1; done`,
    ]).exited;
    if (exitCode !== 0) {
      throw Error('SSH server launch timeout');
    }

    const conn = new SSHConnector({
      name: 'ssh',
      host: 'localhost',
      port: SSH_PORT,
      user: 'testuser',
      key: PRIVATE_KEY_PATH,
      strictHostKeyChecking: false,
      controlMaster: true,
    });

    return await apply('test', conn, fn, { vars: { container } });
  }, options);
}
