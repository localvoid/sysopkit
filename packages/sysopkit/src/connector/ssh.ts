import { chmod, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

import { ConnectorBase, type ConnectorOptions } from '../core/connector.js';
import { ConnectorError } from '../core/errors.js';
import { type Process, processSpawn } from '../utils/process.js';
import { $_ } from '../utils/shell.js';

/** Options for creating an SSH connector. */
export interface SSHOptions extends ConnectorOptions {
  /** SSH host. */
  readonly host: string;
  /** SSH port (default: 22). */
  readonly port?: number;
  /** SSH user (default: root). */
  readonly user?: string;
  /** Path to SSH private key file. */
  readonly key?: string;
  /** Password for authentication (uses SSH_ASKPASS). */
  readonly password?: string;
  /** ConnectTimeout. */
  readonly timeout?: number;
  /** Strict Host Key Checking. */
  readonly strictHostKeyChecking?: boolean;
  /**
   * Enable SSH ControlMaster for connection multiplexing. When enabled (default), a master
   * connection is established on first use and reused for subsequent commands, improving
   * performance.
   */
  readonly controlMaster?: boolean;
  /**
   * Keeps the master connection alive for N minutes after the last script command finishes.
   * (default: 5m)
   */
  readonly controlPersist?: string;
  /** Path to SSH agent socket for agent forwarding. */
  readonly authSocket?: string;
}

/**
 * Connector for executing commands on remote hosts via SSH.
 *
 * Uses the system `ssh` command with BatchMode for non-interactive
 * connections. When a password is provided, uses `SSH_ASKPASS` with
 * `SSH_ASKPASS_REQUIRE=force` for automated password authentication.
 *
 * When controlMaster is enabled (default), a master SSH connection
 * is established on first use and reused for subsequent commands,
 * improving performance by avoiding repeated authentication.
 */
export class SSHConnector extends ConnectorBase {
  /** SSH port (default: 22). */
  readonly port: number;
  /** SSH user for authentication (default: root). */
  readonly user: string;
  /** Path to SSH private key (optional). */
  readonly key: string | undefined;
  /** Password for authentication (optional). */
  readonly password: string | undefined;
  /** ConnectTimeout (default: 5) */
  readonly timeout: number;
  /** Strict host key checking. */
  readonly strictHostKeyChecking: boolean | undefined;
  /** Enable ControlMaster. */
  readonly controlMaster: boolean;
  /** ControlPersist (default: 5m). */
  readonly controlPersist: string;
  env: NodeJS.ProcessEnv;

  private connected: boolean;
  private connectionError: ConnectorError | undefined;
  private tmpPath: string | undefined;
  private controlPath: string | undefined;
  private _rsh: string[] | undefined;

  constructor(options: SSHOptions) {
    super(options.host, options.name ?? options.host, options.vars);
    this.port = options.port ?? 22;
    this.user = options.user ?? 'root';
    this.key = options.key;
    this.password = options.password;
    this.timeout = options.timeout ?? 5;
    this.strictHostKeyChecking = options.strictHostKeyChecking;
    this.controlMaster = options.controlMaster ?? true;
    this.controlPersist = options.controlPersist ?? '5m';
    this.env = options.authSocket
      ? { ...process.env, SSH_AUTH_SOCKET: options.authSocket }
      : { ...process.env };

    this.connected = false;
    this.connectionError = void 0;
    this.tmpPath = void 0;
    this.controlPath = void 0;
    this._rsh = void 0;
  }

  get rsh(): string[] {
    if (this._rsh !== void 0) {
      return this._rsh;
    }
    const rsh = [
      'ssh',
      '-l',
      this.user,
      '-o',
      'LogLevel=ERROR',
      '-o',
      `ConnectTimeout=${this.timeout}`,
    ];
    if (this.password) {
      rsh.push('-o', 'NumberOfPasswordPrompts=1');
    } else {
      rsh.push('-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes');
    }
    if (this.strictHostKeyChecking === false) {
      rsh.push('-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null');
    }
    if (this.controlPath) {
      rsh.push(
        '-o',
        'ControlMaster=auto',
        '-o',
        `ControlPath=${this.controlPath}`,
        '-o',
        `ControlPersist=${this.controlPersist}`,
      );
    }
    if (this.port !== 22) {
      rsh.push('-p', String(this.port));
    }
    if (this.key) {
      rsh.push('-i', this.key);
    }
    this._rsh = rsh;
    return rsh;
  }

  override async connect(signal?: AbortSignal): Promise<void> {
    if (!this.connected) {
      this.tmpPath = await mkdtemp(join(tmpdir(), `sysopkit-ssh-${this.host}_`));
      if (this.controlMaster) {
        this.controlPath = join(this.tmpPath, 'connection');
      }

      if (this.password) {
        const askpassPath = join(this.tmpPath, 'askpass.sh');
        await writeFile(askpassPath, `#!/bin/sh\necho $SYSOPKIT_SSH_PASSWORD\n`);
        await chmod(askpassPath, 0o700);
        this.env = {
          ...this.env,
          SSH_ASKPASS: askpassPath,
          SSH_ASKPASS_REQUIRE: 'force',
          SYSOPKIT_SSH_PASSWORD: this.password,
        };
      }

      const proc = processSpawn([...this.rsh, this.host, 'exit'], signal, this.env);
      const [exitCode, _stdout, stderr] = await Promise.all([
        proc.exited,
        text(proc.stdout),
        text(proc.stderr),
      ]);

      if (exitCode === 0) {
        this.connected = true;
      } else {
        this.connectionError = new ConnectorError(
          `SSH connection '${this.user}@${this.host}' connect failed with exit code '${exitCode}'.${stderr ? `\n${stderr}` : ''}`,
          this,
        );
      }
    }
    if (this.connectionError) {
      throw this.connectionError;
    }
  }

  async spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    return processSpawn([...this.rsh, this.host, cmd.map($_).join(' ')], signal, this.env);
  }

  /**
   * Disposes of the SSH connection resources.
   *
   * If a ControlMaster connection was established, sends the exit signal to the master process.
   */
  override async [Symbol.asyncDispose](): Promise<void> {
    if (this.tmpPath) {
      if (this.controlPath) {
        try {
          await stat(this.controlPath);
          const proc = processSpawn([...this.rsh, '-O', 'EXIT', this.host], void 0, this.env);
          const [_exitCode, _stdout, _stderr] = await Promise.all([
            proc.exited,
            text(proc.stdout),
            text(proc.stderr),
          ]);
        } catch {}
      }
      await rm(this.tmpPath, RECURSIVE_TRUE);
      this.tmpPath = void 0;
    }
  }
}

const RECURSIVE_TRUE = { recursive: true };
