import { randomUUID } from 'node:crypto';
import { chmod } from 'node:fs/promises';
import { createServer } from 'node:net';
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
   * Publish container port 22 to a dynamically allocated host port
   * (exposed as {@link Container.sshPort}). Defaults to true for
   * backwards compatibility. Set to false for containers that never use SSH
   * (e.g. shared PodmanConnector containers) so multiple containers can
   * coexist without host port collisions. Required for parallel e2e
   * (`bun test --parallel`): every SSH container gets its own host port.
   */
  readonly publishSsh?: boolean;
  /**
   * Run the container with `--privileged` (adds all capabilities, e.g.
   * `CAP_SYS_ADMIN` for `mount(2)`). Only for suites that need real
   * mount/umount; mounts stay inside the container's mount namespace and
   * must use unique `remoteTempPath()` targets — never host paths.
   */
  readonly privileged?: boolean;
}

export const CONTAINER_FIXTURES_DIR: string = join(import.meta.dirname, '../fixtures/container');
const PRIVATE_KEY_PATH = join(CONTAINER_FIXTURES_DIR, 'private_key');

/**
 * Git checkouts restore the test private key as 0644 (git has no 0600
 * mode), and OpenSSH with BatchMode ignores group/other-readable keys.
 * The bootstrap scripts chmod it, but they are skipped when CI reuses a
 * cached image — so ensure 0600 here, at test time.
 */
async function ensurePrivateKeyPerms(): Promise<void> {
  try {
    await chmod(PRIVATE_KEY_PATH, 0o600);
  } catch {
    // A missing/unreadable key surfaces as a clear SSH auth failure below.
  }
}

/** Cached host AppArmor detection for {@link hasAppArmor}. */
let apparmorCache: boolean | undefined;

/**
 * Whether the host enforces AppArmor. Best-effort: any read failure means
 * no AppArmor (e.g. Fedora/Arch hosts without the kernel module).
 */
async function hasAppArmor(): Promise<boolean> {
  if (apparmorCache === undefined) {
    try {
      apparmorCache =
        (await Bun.file('/sys/module/apparmor/parameters/enabled').text()).trim() === 'Y';
    } catch {
      apparmorCache = false;
    }
  }
  return apparmorCache;
}

/** Allocates a free loopback TCP port for SSH publishing. */
function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('Failed to allocate free port'));
        }
      });
    });
  });
}

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
  readonly publishSsh: boolean;
  readonly privileged: boolean;
  /** Host port publishing container port 22. Undefined when publishSsh is false. */
  sshPort: number | undefined;
  private started = false;

  constructor(options: ContainerOptions) {
    this.name = `sysopkit-test-${randomUUID().slice(0, 8)}`;
    this.distro = options.distro;
    this.image = TEST_IMAGES[options.distro].image;
    this.user = options.user;
    this.publishSsh = options.publishSsh !== false;
    this.sshPort = undefined;
    this.privileged = options.privileged === true;
  }

  /** Compat accessor for `{ hostPort: containerPort }` publishing. */
  get ports(): Record<number, number> | undefined {
    return this.sshPort === undefined ? undefined : { [this.sshPort]: 22 };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await checkImageLoaded(this.distro);

    if (this.publishSsh && this.sshPort === undefined) {
      this.sshPort = await allocateFreePort();
    }

    for (let attempt = 0; attempt < 5; attempt++) {
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

      if (this.privileged) {
        args.push('--privileged');
      }

      // On hosts with enforcing AppArmor (e.g. Ubuntu), the default container
      // profile denies cap_dac_override to the unix_chkpwd PAM helper (which
      // drops to the target uid, then needs the capability to read the
      // mode-000 /etc/shadow), breaking all password verification and PAM
      // account checks in CI. Opt out where AppArmor is present; elsewhere
      // this flag is skipped entirely.
      if (await hasAppArmor()) {
        args.push('--security-opt', 'apparmor=unconfined');
      }

      if (this.ports) {
        for (const [hostPort, containerPort] of Object.entries(this.ports)) {
          args.push('-p', `${hostPort}:${containerPort}`);
        }
      }

      args.push(this.image, '/bin/sh', '-c', "trap 'exit 0' TERM; tail -f /dev/null & wait $!");

      const proc = Bun.spawn(args, { stderr: 'pipe' });
      const [exitCode, stderr] = await Promise.all([proc.exited, proc.stderr.text()]);
      if (exitCode === 0) {
        await this.waitForReady();
        this.started = true;
        return;
      }
      if (
        this.publishSsh &&
        attempt < 4 &&
        /address already in use|port is already allocated|binding.*failed|addr.*in use/i.test(
          stderr,
        )
      ) {
        this.sshPort = await allocateFreePort();
        continue;
      }
      throw new Error(`Failed to start container: ${stderr}`);
    }
  }

  private async waitForReady(timeout = 30000): Promise<void> {
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

function sshPortFor(container: Container, port?: number): number {
  const resolved = port ?? container.sshPort;
  if (resolved === undefined) {
    throw new Error(
      'SSH container has no published host port (publishSsh: false?). Use publishSsh (default true) for SSH suites.',
    );
  }
  return resolved;
}

export async function withSsh<R>(
  fn: (ctx: ExecutionContext) => Promise<R>,
  options: ContainerOptions,
): Promise<ApplyResult<R>> {
  return await withContainer(async ({ container }) => {
    await ensureSshd(container);
    await ensurePrivateKeyPerms();

    const conn = new SSHConnector({
      name: 'ssh',
      // IPv4 loopback, not 'localhost': the port is allocated and probed on
      // 127.0.0.1, and on hosts where localhost prefers ::1 the SSH client
      // can hit an accept-then-close IPv6 forward without falling back.
      host: '127.0.0.1',
      port: sshPortFor(container),
      user: sshUserFor(container),
      key: PRIVATE_KEY_PATH,
      strictHostKeyChecking: false,
      controlMaster: true,
    });

    return await apply('test', conn, fn, { vars: { container } });
  }, options);
}

async function waitForSsh(port: number): Promise<void> {
  // Probe the SSH handshake, not just TCP: a port forwarder can accept a
  // connection and immediately close it without a working sshd behind it,
  // which a bare /dev/tcp open cannot distinguish (false ready). The loop
  // must report failure via its exit code: a trailing `sleep` always
  // succeeds, so `exit 1` after the loop is required.
  const exitCode = await Bun.spawn([
    'bash',
    '-c',
    `for i in {1..24}; do if exec 3<>/dev/tcp/127.0.0.1/${port} 2>/dev/null; then if read -t 2 -r banner <&3 2>/dev/null && [[ "$banner" == SSH-* ]]; then exit 0; fi; exec 3<&- 3>&- 2>/dev/null; fi; sleep 0.25; done; exit 1`,
  ]).exited;
  if (exitCode !== 0) {
    throw Error('SSH server launch timeout');
  }
}

/** Verifies sshd listens on container port 22 from inside the container. */
async function ensureSshListener(container: Container): Promise<void> {
  // Open-only check (no banner write) to avoid "invalid format" noise in the
  // sshd log; the banner itself is verified from the host by waitForSsh.
  const inside = await container.exec(
    ['bash', '-c', 'exec 3<>/dev/tcp/127.0.0.1/22 && echo LISTENING'],
    { user: 'root' },
  );
  if (inside.exitCode !== 0 || !inside.stdout.includes('LISTENING')) {
    throw new Error(`sshd is not listening on container port 22.`);
  }
}

/**
 * Verifies dropbear listens on container port 22 from inside the container.
 * Busybox `ash` has no `/dev/tcp` and busybox `nc` has no `-z`, so probe via
 * `netstat -ltn` (present in the OpenWrt rootfs); the SSH banner itself is
 * verified from the host by waitForSsh (`SSH-2.0-dropbear*` matches `SSH-*`).
 */
async function ensureDropbearListener(container: Container): Promise<void> {
  const inside = await container.exec(
    // NOTE: plain `pgrep` (no `-x`): busybox pgrep `-x` fails to match the
    // dropbear comm while plain matching works (verified live).
    ['sh', '-c', 'pgrep dropbear > /dev/null 2>&1 && netstat -ltn 2>/dev/null | grep -q ":22 "'],
    { user: 'root' },
  );
  if (inside.exitCode !== 0) {
    throw new Error(`dropbear is not listening on container port 22.`);
  }
}

/** SSH login user per distro: OpenWrt is root-only (no sudo user). */
export function sshUserFor(container: Container): string {
  return container.distro === 'openwrt' ? 'root' : 'testuser';
}

/**
 * Starts the SSH server inside the container if it isn't running yet, then
 * waits for the host port to accept connections. Idempotent: safe to call
 * once per shared container (in `beforeAll`) instead of once per test.
 *
 * SSH-based suites run on debian (OpenSSH) and openwrt (dropbear); other
 * distros are rejected.
 * Defaults to the container's dynamically allocated {@link Container.sshPort}
 * so parallel e2e files (`bun test --parallel`) don't collide.
 */
export async function ensureSshd(container: Container, port?: number): Promise<void> {
  if (container.distro !== 'debian' && container.distro !== 'openwrt') {
    throw new Error(
      `SSH test containers are only supported on debian and openwrt (got '${container.distro}').`,
    );
  }
  if (container.distro === 'openwrt') {
    await ensureDropbear(container);
  } else {
    await ensureOpensshd(container);
  }
  await waitForSsh(sshPortFor(container, port));
}

async function ensureOpensshd(container: Container): Promise<void> {
  // No systemd-tmpfiles in containers: the privilege separation directory
  // may be missing, in which case sshd refuses to start.
  const runDir = await container.exec(['sh', '-c', 'mkdir -p /run/sshd && chmod 755 /run/sshd'], {
    user: 'root',
  });
  if (runDir.exitCode !== 0) {
    throw new Error(`Failed to prepare sshd run directory: ${runDir.stderr.trim()}`);
  }
  const check = await container.exec(['sh', '-c', 'pgrep -x sshd > /dev/null 2>&1']);
  if (check.exitCode !== 0) {
    // -E captures startup failures for diagnostics instead of /dev/null.
    const started = await container.exec([
      'sh',
      '-c',
      'nohup /usr/sbin/sshd -E /tmp/sshd-init.log > /dev/null 2>&1 &',
    ]);
    if (started.exitCode !== 0) {
      throw new Error(`Failed to start sshd: ${started.stderr.trim()}`);
    }
  }
  await ensureSshListener(container);
}

/**
 * Starts dropbear inside an OpenWrt container if it isn't running yet.
 * Host keys and root authorized_keys are baked into the image by
 * scripts/bootstrap-openwrt.sh; `-R` regenerates missing host keys so
 * stale cached images (built before key provisioning) still work.
 */
async function ensureDropbear(container: Container): Promise<void> {
  const check = await container.exec(['sh', '-c', 'pgrep dropbear > /dev/null 2>&1'], {
    user: 'root',
  });
  if (check.exitCode !== 0) {
    // -E logs to stderr (captured for diagnostics); dropbear forks into the
    // background by itself (`&` releases the exec session; no `nohup` applet
    // on busybox).
    const started = await container.exec(
      ['sh', '-c', '/usr/sbin/dropbear -R -p 22 -E > /tmp/dropbear-init.log 2>&1 &'],
      { user: 'root' },
    );
    if (started.exitCode !== 0) {
      throw new Error(`Failed to start dropbear: ${started.stderr.trim()}`);
    }
  }
  await ensureDropbearListener(container);
}

/**
 * Starts a container meant to be shared across all tests in a file.
 * Call in `beforeAll`, stop it in `afterAll`. Tests within a file run
 * serially; files run in parallel via `bun test --parallel`.
 */
export async function startSharedContainer(options: ContainerOptions): Promise<Container> {
  const container = new Container(options);
  await container.start();
  return container;
}

/**
 * Starts a container with its SSH server running, shared across all tests in
 * a file. The server is started once via `ensureSshd` (sshd or dropbear).
 */
export async function startSharedSshContainer(options: ContainerOptions): Promise<Container> {
  const container = await startSharedContainer(options);
  await ensureSshd(container);
  return container;
}

export interface SharedRunOptions {
  readonly dryRun?: boolean;
  /**
   * Override ControlMaster multiplexing for SSH runs (default true).
   * Ignored by {@link sharedPodman}. Used to prove the non-multiplexed
   * fallback path (e.g. against dropbear).
   */
  readonly controlMaster?: boolean;
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
 * Reuses a single connected PodmanConnector per container (the
 * `podman inspect` state check runs once), while every test still gets a
 * fresh `start()`/`apply()` context — so per-test cost is ~0 container boots
 * and ~0 reconnects. `dryRun` stays per-test since it lives on the context,
 * not the connector.
 */
const podmanConnectors = new WeakMap<Container, PodmanConnector>();

function podmanConnectorFor(container: Container): PodmanConnector {
  let conn = podmanConnectors.get(container);
  if (!conn) {
    conn = new PodmanConnector({
      name: `podman-${container.name}`,
      host: container.name,
    });
    podmanConnectors.set(container, conn);
  }
  return conn;
}

export async function sharedPodman<R>(
  container: Container,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: SharedRunOptions,
): Promise<ApplyResult<R>> {
  return await runShared(container, podmanConnectorFor(container), fn, options);
}

/**
 * Runs `fn` against a shared container via SSH.
 * Assumes the SSH server was started once via `ensureSshd` /
 * `startSharedSshContainer`. Creates a fresh connector per test (one SSH
 * handshake, multiplexed). Login user follows the container distro
 * (`testuser` on parity distros, `root` on openwrt).
 */
export async function sharedSsh<R>(
  container: Container,
  fn: (ctx: ExecutionContext) => Promise<R>,
  options?: SharedRunOptions,
): Promise<ApplyResult<R>> {
  await ensurePrivateKeyPerms();
  const conn = new SSHConnector({
    name: 'ssh',
    // IPv4 loopback, not 'localhost': see withSsh above.
    host: '127.0.0.1',
    port: sshPortFor(container),
    user: sshUserFor(container),
    key: PRIVATE_KEY_PATH,
    strictHostKeyChecking: false,
    controlMaster: options?.controlMaster ?? true,
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
