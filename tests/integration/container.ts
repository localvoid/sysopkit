import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { apply, type ApplyResult, type Connector, type ExecutionContext } from 'sysopkit';
import { PodmanConnector } from 'sysopkit/connector/podman';
import { SSHConnector } from 'sysopkit/connector/ssh';
import { type ExecResult } from 'sysopkit/op/exec';
import { start } from 'sysopkit/start';

import { TEST_IMAGES, type TestDistro } from './images.js';

export type { TestDistro } from './images.js';

export interface ContainerOptions {
  /** Test container distro. Explicit, no default: every suite picks one. */
  readonly distro: TestDistro;
  readonly user?: string;
  readonly dryRun?: boolean;
  /**
   * Publish container port 22 to host {@link SSH_PORT}. Defaults to true for
   * backwards compatibility. Set to false for containers that never use SSH
   * (e.g. shared PodmanConnector containers) so multiple containers can
   * coexist without host port collisions.
   */
  readonly publishSsh?: boolean;
}

export const CONTAINER_FIXTURES_DIR: string = join(import.meta.dirname, '../fixtures/container');
const PRIVATE_KEY_PATH = join(CONTAINER_FIXTURES_DIR, 'private_key');
const SSH_PORT = 2222;

async function checkImageLoaded(distro: TestDistro): Promise<void> {
  const { image, archive } = TEST_IMAGES[distro];
  const exitCode = await Bun.spawn(['podman', 'image', 'inspect', image]).exited;
  if (exitCode !== 0) {
    throw new Error(
      `Image '${image}' not found. Run 'bun run test:container:init ${distro}' to build it (archive '${archive}').`,
    );
  }
}

export class Container {
  readonly name: string;
  readonly distro: TestDistro;
  readonly image: string;
  readonly user: string | undefined;
  readonly ports: Record<number, number> | undefined;
  private started = false;

  constructor(options: ContainerOptions) {
    this.name = `sysopkit-test-${randomUUID().slice(0, 8)}`;
    this.distro = options.distro;
    this.image = TEST_IMAGES[options.distro].image;
    this.user = options.user;
    this.ports = options.publishSsh === false ? undefined : { [SSH_PORT]: 22 };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await checkImageLoaded(this.distro);

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

    args.push(this.image, '/bin/sh', '-c', "trap 'exit 0' TERM; tail -f /dev/null & wait $!");

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
  options: ContainerOptions,
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
  options: ContainerOptions,
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
  options: ContainerOptions,
): Promise<ApplyResult<R>> {
  return await withContainer(async ({ container }) => {
    await ensureSshd(container);

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

async function waitForSsh(port: number): Promise<void> {
  const exitCode = await Bun.spawn([
    'bash',
    '-c',
    `for i in {1..20}; do (echo > /dev/tcp/127.0.0.1/${port}) >/dev/null 2>&1 && break || sleep 0.1; done`,
  ]).exited;
  if (exitCode !== 0) {
    throw Error('SSH server launch timeout');
  }
}

/**
 * Starts sshd inside the container if it isn't running yet, then waits for
 * the host port to accept connections. Idempotent: safe to call once per
 * shared container (in `beforeAll`) instead of once per test.
 *
 * SSH-based suites only run on fedora; other distros are rejected.
 */
export async function ensureSshd(container: Container, port: number = SSH_PORT): Promise<void> {
  if (container.distro !== 'fedora') {
    throw new Error(
      `SSH test containers are only supported on fedora (got '${container.distro}').`,
    );
  }
  const check = await container.exec(['sh', '-c', 'pgrep -x sshd > /dev/null 2>&1']);
  if (check.exitCode !== 0) {
    await container.exec(['sh', '-c', 'nohup /usr/sbin/sshd > /dev/null 2>&1 &']);
  }
  await waitForSsh(port);
}

/**
 * Starts a container meant to be shared across all tests in a file.
 * Call in `beforeAll`, stop it in `afterAll`. Serial execution assumed.
 */
export async function startSharedContainer(options: ContainerOptions): Promise<Container> {
  const container = new Container(options);
  await container.start();
  return container;
}

/**
 * Starts a container with sshd running, shared across all tests in a file.
 */
export async function startSharedSshContainer(options: ContainerOptions): Promise<Container> {
  const container = await startSharedContainer(options);
  await ensureSshd(container);
  return container;
}

export interface SharedRunOptions {
  readonly dryRun?: boolean;
}

async function runShared<R>(
  container: Container,
  conn: Connector,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: SharedRunOptions,
): Promise<ApplyResult<R>> {
  const result = await start(
    async () => {
      return await apply('test', conn, fn, { vars: { container } });
    },
    { dryRun: options?.dryRun },
  );
  if (result.success) {
    return result.result;
  }
  throw result.error;
}

/**
 * Runs `fn` against a shared container via PodmanConnector.
 * Creates a fresh connector per test (cheap `podman inspect`) while reusing
 * the running container, so per-test cost is ~0 container boots.
 */
export async function sharedPodman<R>(
  container: Container,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: SharedRunOptions,
): Promise<ApplyResult<R>> {
  const conn = new PodmanConnector({
    name: `podman-${container.name}`,
    host: container.name,
  });
  return await runShared(container, conn, fn, options);
}

/**
 * Runs `fn` against a shared container via SSH.
 * Assumes sshd was started once via `ensureSshd` / `startSharedSshContainer`.
 * Creates a fresh connector per test (one SSH handshake, multiplexed).
 */
export async function sharedSsh<R>(
  container: Container,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: SharedRunOptions,
): Promise<ApplyResult<R>> {
  const conn = new SSHConnector({
    name: 'ssh',
    host: 'localhost',
    port: SSH_PORT,
    user: 'testuser',
    key: PRIVATE_KEY_PATH,
    strictHostKeyChecking: false,
    controlMaster: true,
  });
  return await runShared(container, conn, fn, options);
}

/**
 * Generates a unique remote path under /tmp for use in shared containers.
 * Pure path generator (no exec): the path is unique per call, so tests stay
 * isolated without per-test container boots. Works in dry-run mode too since
 * nothing is created. The shared container is discarded in `afterAll`, so no
 * cleanup is needed.
 */
export function remoteTempPath(prefix = 'sysopkit-test-'): string {
  return `/tmp/${prefix}${randomUUID().slice(0, 8)}`;
}
