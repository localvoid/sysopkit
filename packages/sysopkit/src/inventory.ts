/**
 * @module inventory
 *
 * Inventory types and utilities for host management.
 */

import { PodmanConnector } from './connector/podman.js';
import { SSHConnector } from './connector/ssh.js';
import { type Connector } from './core/connector.js';

/**
 * Configuration for an individual host.
 */
export interface HostConfig {
  /** Connection target (e.g., hostname, IP, or special prefix like "ssh:", "pod:"). */
  readonly host?: string;
  /** Username for authentication. */
  readonly user?: string;
  /** Port number for connection. */
  readonly port?: number;
  /** Host-specific variables that override group/inventory vars. */
  readonly vars?: Record<symbol | string, any>;
  /** Host-specific tags. */
  readonly tags?: string[];
}

/**
 * Configuration for a group of hosts.
 */
export interface GroupConfig {
  /** Group-level variables that override inventory vars. */
  readonly vars?: Record<symbol | string, any>;
  /** Group-level tags inherited by all hosts in the group. */
  readonly tags?: string[];
  /** Map of host names to their configurations. */
  readonly hosts: Record<string, HostConfig>;
}

/**
 * Root inventory structure defining all hosts and groups.
 */
export interface Inventory {
  /** Top-level variables available to all hosts. */
  readonly vars?: Record<symbol | string, any>;
  /** Map of group names to their configurations. */
  readonly groups: Record<string, GroupConfig>;
}

/** A resolved host with merged variables and connection details from inventory configuration. */
export interface ResolvedHost {
  readonly name: string;
  readonly host: string;
  readonly user?: string;
  readonly port?: number;
  readonly vars: Record<symbol | string, any>;
  /** Merged tags from group and host (deduplicated). */
  readonly tags: string[];
}

/** Factory function that creates a connector from a resolved host configuration. */
export type ConnectorFactory = (host: string, h: ResolvedHost) => Connector;

/** Options for inventory connection creation. */
export interface ConnectOptions {
  /** Custom connector factories keyed by host prefix (e.g., "k8s:", "docker:"). */
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

  constructor(inventory: Inventory, options?: ConnectOptions) {
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

        const resolved: ResolvedHost = {
          name,
          host: hostConfig.host ?? name,
          user: hostConfig.user,
          port: hostConfig.port,
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
 * // With custom connector
 * await using hosts = resolveInventory(
 *   { groups: { k8s: { hosts: { node1: { host: "k8s:node1" } } } } },
 *   { connectors: { k8s: (h) => new K8sConnector({ name: h.name, host: h.host.slice(4) }) } }
 * );
 */
export function resolveInventory(
  inventory: Inventory,
  options?: ConnectOptions,
): ResolvedInventory {
  return new ResolvedInventory(inventory, options);
}

const DEFAULT_CONNECTORS: Record<string, ConnectorFactory> = {
  pod: (host: string, h: ResolvedHost): Connector => {
    if (!host) {
      throw new Error(`Podman connector requires a container ID: ${host}`);
    }
    return new PodmanConnector({
      ...h,
      host,
    });
  },
  ssh: (host: string, h: ResolvedHost): Connector => {
    if (!host) {
      throw new Error(`SSH connector requires a host: ${host}`);
    }
    return new SSHConnector({
      ...h,
      host,
    });
  },
};

function _createConnector(h: ResolvedHost, factories: Record<string, ConnectorFactory>): Connector {
  const hostStr = h.host;
  let prefix: string | undefined = void 0;
  let host = hostStr;
  const idx = hostStr.indexOf(':');
  if (idx !== -1) {
    prefix = hostStr.slice(0, idx);
    host = hostStr.slice(idx + 1);
  }

  if (prefix && factories[prefix]) {
    return factories[prefix](host, h);
  }

  return new SSHConnector({
    host,
    name: h.name,
    vars: h.vars,
    user: h.user,
    port: h.port,
  });
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
