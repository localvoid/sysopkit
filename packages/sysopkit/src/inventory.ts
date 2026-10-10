/**
 * @module inventory
 *
 * Inventory types and utilities for host management.
 */

import { PodmanConnector, type PodmanConnectorOptions } from './connector/podman.js';
import { SSHConnector, type SSHOptions } from './connector/ssh.js';
import { type Connector } from './core/connector.js';

/**
 * Base host config: universal fields only. Connection specifics
 * (user, port, keys, timeouts, …) live in per-type `options`,
 * passed straight into the connector constructor.
 *
 * Custom types: declare your own member over this base and combine
 * it with the built-ins, e.g.
 * `type MyHosts = SshHostConfig | K8sHostConfig`, then use
 * `Inventory<MyHosts>`.
 */
export interface BaseHostConfig {
  /** Connection target (plain address; default: host name). */
  readonly host?: string;
  /** Connector type (default `'ssh'`). */
  readonly type?: string;
  /** Extra options passed straight into the connector constructor. */
  readonly options?: Record<string, any>;
  /** Host-specific variables that override group/inventory vars. */
  readonly vars?: Record<symbol | string, any>;
  /** Host-specific tags. */
  readonly tags?: string[];
}

/** SSH host (default when `type` is absent). */
export interface SshHostConfig extends BaseHostConfig {
  readonly type?: 'ssh';
  readonly options?: Partial<SSHOptions>;
}

/** Podman host. */
export interface PodHostConfig extends BaseHostConfig {
  readonly type: 'pod';
  readonly options?: Partial<PodmanConnectorOptions>;
}

/** Built-in host configs. */
export type HostConfig = SshHostConfig | PodHostConfig;

/**
 * Configuration for a group of hosts.
 */
export interface GroupConfig<T extends BaseHostConfig = HostConfig> {
  /** Group-level variables that override inventory vars. */
  readonly vars?: Record<symbol | string, any>;
  /** Group-level tags inherited by all hosts in the group. */
  readonly tags?: string[];
  /** Map of host names to their configurations. */
  readonly hosts: Record<string, T>;
}

/**
 * Root inventory structure defining all hosts and groups.
 */
export interface Inventory<T extends BaseHostConfig = HostConfig> {
  /** Top-level variables available to all hosts. */
  readonly vars?: Record<symbol | string, any>;
  /** Map of group names to their configurations. */
  readonly groups: Record<string, GroupConfig<T>>;
}

/** A resolved host with merged variables and connection details from inventory configuration. */
export interface ResolvedHost {
  readonly name: string;
  readonly host: string;
  readonly type: string;
  readonly options: Record<string, any>;
  readonly vars: Record<symbol | string, any>;
  /** Merged tags from group and host (deduplicated). */
  readonly tags: string[];
}

/** Factory function that creates a connector from a resolved host. */
export type ConnectorFactory = (host: ResolvedHost) => Connector;

/** Options for inventory connection creation. */
export interface ConnectOptions {
  /** Custom connector factories keyed by host type (e.g., "k8s", "docker"). */
  readonly connectors?: Record<string, ConnectorFactory>;
}

/**
 * Connected inventory with lazy connector creation and cleanup.
 *
 * Resolves hosts, merges variables, and creates connections on-demand.
 * Implements AsyncDisposable for cleaning up all connections.
 *
 * IMPORTANT: Must be used with `await using` to ensure proper cleanup.
 *
 * @example
 * await start(async () => {
 *   await using hosts = resolveInventory({
 *     groups: { db: { hosts: { db1: {} } } },
 *   });
 *   await apply(hosts.getByGroup("db"), async () => {
 *     await sh("hostname");
 *   });
 * });
 */
export class ResolvedInventory implements AsyncDisposable {
  private readonly hosts: ResolvedHost[];
  private readonly groupMap: Map<string, ResolvedHost[]>;
  private readonly nameMap: Map<string, ResolvedHost>;
  private readonly tagMap: Map<string, Set<ResolvedHost>>;
  private readonly connectors: Map<string, Connector>;
  private readonly factories: Record<string, ConnectorFactory>;
  private disposed: boolean;

  constructor(inventory: Inventory<BaseHostConfig>, options?: ConnectOptions) {
    this.hosts = [];
    this.groupMap = new Map();
    this.nameMap = new Map();
    this.tagMap = new Map();
    this.connectors = new Map();
    this.factories = { ...DEFAULT_CONNECTORS, ...options?.connectors };
    this.disposed = false;

    const inventoryVars = inventory.vars ?? {};

    for (const [groupName, group] of Object.entries(inventory.groups)) {
      const groupVars = { ...inventoryVars, ...group.vars };
      const groupTags = group.tags ?? [];
      const groupHosts: ResolvedHost[] = [];
      this.groupMap.set(groupName, groupHosts);

      for (const [name, hostConfig] of Object.entries(group.hosts)) {
        const hostVars = hostConfig.vars ?? {};
        const hostTags = hostConfig.tags ?? [];
        const mergedTags = [...new Set([...groupTags, ...hostTags])];
        const type = hostConfig.type ?? 'ssh';
        if (!this.factories[type]) {
          throw new Error(
            `unknown host type '${type}' for host '${name}' (want ${Object.keys(this.factories).join(', ')})`,
          );
        }

        const resolved: ResolvedHost = {
          name,
          host: hostConfig.host ?? name,
          type,
          options: hostConfig.options ?? {},
          vars: { ...groupVars, ...hostVars },
          tags: mergedTags,
        };

        this.hosts.push(resolved);
        groupHosts.push(resolved);
        this.nameMap.set(name, resolved);

        for (const tag of resolved.tags) {
          let set = this.tagMap.get(tag);
          if (!set) {
            set = new Set();
            this.tagMap.set(tag, set);
          }
          set.add(resolved);
        }
      }
    }
  }

  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('ResolvedInventory has been disposed');
    }
  }

  /**
   * Gets all connections in a specific group.
   *
   * Creates connections lazily on first access, then caches for reuse.
   */
  getByGroup(name: string): Connector[] {
    this.checkDisposed();
    const hosts = this.groupMap.get(name) ?? [];
    return hosts.map((h) => this.getOrCreate(h));
  }

  /**
   * Gets all connections matching one or more tags.
   *
   * Returns connections matching any of the provided tags (union), deduplicated.
   */
  getByTag(tags: string | readonly string[]): Connector[] {
    this.checkDisposed();
    const tagArray = typeof tags === 'string' ? [tags] : tags;
    const result = new Set<Connector>();

    for (const tag of tagArray) {
      const hosts = this.tagMap.get(tag);
      if (hosts) {
        for (const host of hosts) {
          result.add(this.getOrCreate(host));
        }
      }
    }

    return [...result];
  }

  /** Gets a connection by host name. Returns undefined if not found. */
  getByName(name: string): Connector | undefined {
    this.checkDisposed();
    const host = this.nameMap.get(name);
    return host ? this.getOrCreate(host) : void 0;
  }

  /** Gets all connections in the inventory. */
  getAll(): Connector[] {
    this.checkDisposed();
    return this.hosts.map((h) => this.getOrCreate(h));
  }

  /** Filters connections by a glob pattern (e.g., "web-*", "db?"). */
  match(pattern: string): Connector[] {
    this.checkDisposed();
    const hosts = _matchHosts(this.hosts, pattern);
    return hosts.map((h) => this.getOrCreate(h));
  }

  private getOrCreate(host: ResolvedHost): Connector {
    let conn = this.connectors.get(host.name);
    if (!conn) {
      conn = _createConnector(host, this.factories);
      this.connectors.set(host.name, conn);
    }
    return conn;
  }

  /**
   * Disposes of all connections.
   *
   * Safe to call multiple times.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const conn of this.connectors.values()) {
      await conn[Symbol.asyncDispose]();
    }
    this.connectors.clear();
  }
}

/**
 * Creates a connected inventory from an inventory configuration.
 *
 * Resolves all hosts with merged variables and returns a ResolvedInventory
 * that creates connections lazily on first access.
 *
 * @param inventory - The inventory configuration
 * @param options - Optional configuration including custom connector factories
 * @returns Connected inventory that should be disposed with `await using`
 *
 * @example
 * await start(async () => {
 *   await using hosts = resolveInventory({
 *     groups: {
 *       db: { hosts: { db1: {}, db2: {} } },
 *       web: { hosts: { web1: {}, web2: {} } },
 *     },
 *   });
 *
 *   const dbHosts = hosts.getByGroup("db");
 *   const web1 = hosts.getByName("web1");
 *   const all = hosts.getAll();
 * });
 *
 * @example
 * // With a custom connector type (declare your own combination)
 * interface K8sHostConfig extends BaseHostConfig {
 *   readonly type: 'k8s';
 *   readonly options?: { readonly namespace?: string };
 * }
 * await using hosts = resolveInventory<Inventory<SshHostConfig | K8sHostConfig>>(
 *   { groups: { k8s: { hosts: { node1: { host: 'node1', type: 'k8s' } } } } },
 *   { connectors: { k8s: (h) => new K8sConnector({ name: h.name, host: h.host }) } },
 * );
 */
export function resolveInventory<T extends BaseHostConfig = HostConfig>(
  inventory: Inventory<T>,
  options?: ConnectOptions,
): ResolvedInventory {
  return new ResolvedInventory(inventory, options);
}

const DEFAULT_CONNECTORS: Record<string, ConnectorFactory> = {
  pod: (h: ResolvedHost): Connector => {
    return new PodmanConnector({
      host: h.host,
      name: h.name,
      vars: h.vars,
      ...h.options,
    });
  },
  ssh: (h: ResolvedHost): Connector => {
    return new SSHConnector({
      host: h.host,
      name: h.name,
      vars: h.vars,
      ...h.options,
    });
  },
};

function _createConnector(h: ResolvedHost, factories: Record<string, ConnectorFactory>): Connector {
  const factory = factories[h.type];
  if (!factory) {
    throw new Error(`unknown host type '${h.type}' for host '${h.name}'`);
  }
  return factory(h);
}

function _matchHosts(hosts: ResolvedHost[], pattern: string): ResolvedHost[] {
  if (pattern === '*' || pattern === '') {
    return hosts;
  }

  const regex = _globToRegex(pattern);
  return hosts.filter((h) => regex.test(h.name));
}

function _globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}
