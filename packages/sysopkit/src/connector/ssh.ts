import { chmod, mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

import { ConnectorBase, type ConnectorOptions } from '../core/connector.js';
import { ConnectorError, isAbortError } from '../core/errors.js';
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
  /** Strict host key checking (mutable via disableStrictHostKeyChecking). */
  get strictHostKeyChecking(): boolean | undefined {
    return this._strictHostKeyChecking;
  }
  private _strictHostKeyChecking: boolean | undefined;
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
    this._strictHostKeyChecking = options.strictHostKeyChecking;
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

  /**
   * Permanently stop verifying host keys on subsequently established
   * connections. One-way: cannot be re-enabled on the same instance.
   *
   * A live multiplex master (verified under strict) is untouched until it
   * dies; post-downgrade spawns use `StrictHostKeyChecking=no` +
   * `UserKnownHostsFile=/dev/null`, matching `strictHostKeyChecking: false`
   * construction. For ephemeral targets that rotate keys across reboots
   * (kexec rescue, fresh installs). Callers should log the downgrade via
   * the current context (`ctx.warn(...)`) so op logs show exactly when
   * verification stopped.
   */
  disableStrictHostKeyChecking(): void {
    if (this._strictHostKeyChecking === false) {
      return;
    }
    this._strictHostKeyChecking = false;
    this._rsh = void 0;
  }

  get rsh(): string[] {
    if (this._rsh !== void 0) {
      return this._rsh;
    }
    const rsh = this.buildProbeArgs('ERROR', this.timeout);
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

  /**
   * Shared ssh argument prefix (no multiplexing): `ssh -l <user>`
   * with `LogLevel`, `ConnectTimeout`, auth mode, and host-key options.
   * Callers append multiplex options (connect only), `-p`/`-i`, target,
   * and remote command.
   */
  private buildProbeArgs(logLevel: 'ERROR' | 'VERBOSE', connectTimeout: number): string[] {
    const probe = [
      'ssh',
      '-l',
      this.user,
      '-o',
      `LogLevel=${logLevel}`,
      '-o',
      `ConnectTimeout=${connectTimeout}`,
    ];
    if (this.password) {
      probe.push('-o', 'NumberOfPasswordPrompts=1');
    } else {
      probe.push('-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes');
    }
    if (this.strictHostKeyChecking === false) {
      probe.push('-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null');
    }
    return probe;
  }

  override async connect(signal?: AbortSignal): Promise<void> {
    if (!this.connected) {
      if (this.key) {
        let mode: number;
        try {
          mode = (await stat(this.key)).mode & 0o777;
        } catch {
          this.connectionError = new ConnectorError(
            `SSH connection '${this.user}@${this.host}' key file '${this.key}' is not accessible.`,
            this,
          );
          throw this.connectionError;
        }
        if (mode & 0o077) {
          this.connectionError = new ConnectorError(
            `SSH connection '${this.user}@${this.host}' private key '${this.key}' has mode ${mode.toString(8).padStart(3, '0')} (group/other-readable); OpenSSH ignores such keys and the connection fails. Run: chmod 600 '${this.key}'.`,
            this,
          );
          throw this.connectionError;
        }
        try {
          const handle = await open(this.key, 'r');
          await handle.close();
        } catch {
          this.connectionError = new ConnectorError(
            `SSH connection '${this.user}@${this.host}' key file '${this.key}' is not readable by the current user.`,
            this,
          );
          throw this.connectionError;
        }
      }
      // Drop state from a previous failed attempt so retry allocates a
      // fresh tmpdir/ControlPath instead of leaking the old one.
      this._rsh = void 0;
      this.connectionError = void 0;
      try {
        this.tmpPath = await mkdtemp(join(tmpdir(), `sysopkit-ssh-${this.host}_`));
        if (this.controlMaster) {
          this.controlPath = join(this.tmpPath, 'connection');
        }
        // Recompute with the fresh ControlPath (not a stale cached one).
        this._rsh = void 0;

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
          // Always capture a verbose retry: some OpenSSH versions suppress
          // auth diagnostics (e.g. key rejection) at LogLevel=ERROR, which
          // otherwise surfaces as a blank exit-255 failure.
          const verbose = await this.verboseDiagnosis(signal);
          const detail = [stderr.trim(), verbose.trim()]
            .filter((part) => part.length > 0)
            .join('\n');
          this.connectionError = new ConnectorError(
            `SSH connection '${this.user}@${this.host}' connect failed with exit code '${exitCode}'.${detail ? `\n${detail}` : ''}`,
            this,
          );
        }
      } catch (e) {
        if (isAbortError(e) || signal?.aborted === true) {
          await this.cleanupTmp();
          throw e;
        }
        if (this.connectionError === void 0) {
          const msg = e instanceof Error ? e.message : String(e);
          this.connectionError = new ConnectorError(
            `SSH connection '${this.user}@${this.host}' connect failed: ${msg}`,
            this,
          );
        }
      }
      if (this.connectionError !== void 0) {
        await this.cleanupTmp();
      }
    }
    if (this.connectionError) {
      throw this.connectionError;
    }
  }

  /**
   * Side-effect-free readiness probe: multiplex-free `ssh <host> exit`
   * with a short `ConnectTimeout`. Allocates no tmpdir, mutates no
   * connection state (`connected`, `connectionError`, `tmpPath`,
   * `controlPath`, `_rsh`). Returns `false` on non-zero exit/auth
   * failure or spawn errors; throws only on abort/misuse.
   */
  override async isReady(signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted();
    if (this.host.length === 0) {
      throw new ConnectorError('SSH isReady: refusing: host is empty.', this);
    }
    const probeTimeout = Math.max(1, Math.min(this.timeout, 5));
    const probe = this.buildProbeArgs('ERROR', probeTimeout);
    if (this.port !== 22) {
      probe.push('-p', String(this.port));
    }
    if (this.key) {
      probe.push('-i', this.key);
    }
    try {
      const proc = processSpawn([...probe, this.host, 'exit'], signal, this.env);
      const [exitCode, _stdout, _stderr] = await Promise.all([
        proc.exited,
        text(proc.stdout),
        text(proc.stderr),
      ]);
      return exitCode === 0;
    } catch (e) {
      if (isAbortError(e) || signal?.aborted === true) {
        throw e;
      }
      return false;
    }
  }

  async spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    return processSpawn([...this.rsh, this.host, cmd.map($_).join(' ')], signal, this.env);
  }

  /**
   * Re-runs the failed probe once with verbose logging and without connection
   * multiplexing to capture the underlying client-side error. `LogLevel=ERROR`
   * suppresses auth diagnostics (e.g. key rejection), which otherwise surfaces
   * as a blank exit-255 failure.
   */
  private async verboseDiagnosis(signal?: AbortSignal): Promise<string> {
    const probe = this.buildProbeArgs('VERBOSE', this.timeout);
    if (this.port !== 22) {
      probe.push('-p', String(this.port));
    }
    if (this.key) {
      probe.push('-i', this.key);
    }
    try {
      const proc = processSpawn([...probe, this.host, 'exit'], signal, this.env);
      const [verboseExit, _stdout, verboseStderr] = await Promise.all([
        proc.exited,
        text(proc.stdout),
        text(proc.stderr),
      ]);
      const trimmed = verboseStderr.trim().slice(-2000);
      return trimmed ? `\n[verbose retry exit ${verboseExit}]\n${trimmed}` : '';
    } catch {
      return '';
    }
  }

  /**
   * Remove the per-attempt tmpdir and drop multiplex state so a manual
   * retry allocates fresh resources instead of leaking the old ones.
   * Keeps `connectionError` for the caller to throw.
   */
  private async cleanupTmp(): Promise<void> {
    if (this.tmpPath !== void 0) {
      try {
        await rm(this.tmpPath, RECURSIVE_TRUE);
      } catch {}
      this.tmpPath = void 0;
    }
    this.controlPath = void 0;
    this._rsh = void 0;
    if ('SSH_ASKPASS' in this.env || 'SYSOPKIT_SSH_PASSWORD' in this.env) {
      const { SSH_ASKPASS, SSH_ASKPASS_REQUIRE, SYSOPKIT_SSH_PASSWORD, ...rest } = this.env;
      void SSH_ASKPASS;
      void SSH_ASKPASS_REQUIRE;
      void SYSOPKIT_SSH_PASSWORD;
      this.env = rest;
    }
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
          // Lowercase `exit`: `ssh -O` multiplex commands are case-sensitive
          // (uppercase `EXIT` is rejected with "Invalid multiplex command").
          const proc = processSpawn([...this.rsh, '-O', 'exit', this.host], void 0, this.env);
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

/**
 * Removes all keys for a host from a known_hosts file via `ssh-keygen -R`.
 *
 * Controller-local (no apply context needed): call it before
 * (re)connecting to hosts with fresh keys — lab VMs and reinstalled
 * servers whose keys rotate every boot — so a stale entry can't trip
 * strict host key checking.
 *
 * @param host - Host name, alias, or address to remove.
 * @param file - Known hosts file. Default: the user's `~/.ssh/known_hosts`.
 */
export async function removeKnownHost(host: string, file?: string): Promise<void> {
  if (host === '' || /\s/.test(host)) {
    throw new Error(`refusing: bad host '${host}'`);
  }
  const cmd =
    file === undefined ? ['ssh-keygen', '-R', host] : ['ssh-keygen', '-R', host, '-f', file];
  const proc = processSpawn(cmd);
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    text(proc.stdout),
    text(proc.stderr),
  ]);
  if (exitCode !== 0) {
    const detail = `${stdout}\n${stderr}`.trim();
    throw new Error(
      `ssh-keygen -R failed for '${host}' (exit ${exitCode})${detail === '' ? '' : `: ${detail}`}`,
    );
  }
}
