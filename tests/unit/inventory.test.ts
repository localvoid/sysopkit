import { describe, expect, test } from 'bun:test';
import { LocalConnector } from 'sysopkit/connector/local';
import { resolveInventory, type ConnectorFactory, type Inventory } from 'sysopkit/inventory';

const localConnector: ConnectorFactory = () => new LocalConnector();

describe('resolveInventory', () => {
  test('creates connected inventory from simple inventory', () => {
    const inventory: Inventory = {
      groups: {
        web: {
          hosts: {
            server1: { host: 'local:' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const all = hosts.getAll();

    expect(all).toHaveLength(1);
  });

  test('uses host name as host address when not specified', () => {
    const inventory: Inventory = {
      groups: {
        web: {
          hosts: {
            myserver: { host: 'local:' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const all = hosts.getAll();

    expect(all).toHaveLength(1);
  });

  test('resolves multiple groups', () => {
    const inventory: Inventory = {
      groups: {
        web: {
          hosts: {
            web1: { host: 'local:' },
            web2: { host: 'local:' },
          },
        },
        db: {
          hosts: {
            db1: { host: 'local:' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const all = hosts.getAll();

    expect(all).toHaveLength(3);
  });

  test('returns empty for empty groups', () => {
    const inventory: Inventory = { groups: {} };

    const hosts = resolveInventory(inventory);
    const all = hosts.getAll();

    expect(all).toHaveLength(0);
  });

  test('getByGroup returns hosts in specific group', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            hosts: {
              web1: { host: 'local:' },
              web2: { host: 'local:' },
            },
          },
          db: {
            hosts: {
              db1: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    const webHosts = inventory.getByGroup('web');
    const dbHosts = inventory.getByGroup('db');

    expect(webHosts).toHaveLength(2);
    expect(dbHosts).toHaveLength(1);
  });

  test('getByName returns specific host', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            hosts: {
              web1: { host: 'local:' },
              web2: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    const host = inventory.getByName('web1');
    expect(host).toBeDefined();

    const missing = inventory.getByName('nonexistent');
    expect(missing).toBeUndefined();
  });

  test('getByTag returns hosts with single tag', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            tags: ['frontend'],
            hosts: {
              web1: { host: 'local:' },
              web2: { host: 'local:' },
            },
          },
          db: {
            tags: ['backend'],
            hosts: {
              db1: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    const result = inventory.getByTag('frontend');

    expect(result).toHaveLength(2);
  });

  test('getByTag returns empty array for non-existent tag', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            hosts: { web1: { host: 'local:' } },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    expect(inventory.getByTag('nonexistent')).toEqual([]);
  });

  test('getByTag with array returns union of hosts', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            tags: ['frontend'],
            hosts: {
              web1: { host: 'local:', tags: ['primary'] },
              web2: { host: 'local:' },
            },
          },
          db: {
            tags: ['backend'],
            hosts: {
              db1: { host: 'local:', tags: ['primary'] },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    const result = inventory.getByTag(['frontend', 'primary']);

    expect(result).toHaveLength(3);
  });

  test('getByTag deduplicates hosts', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            tags: ['http', 'frontend'],
            hosts: {
              web1: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    const result = inventory.getByTag(['http', 'frontend']);

    expect(result).toHaveLength(1);
  });

  test('match filters hosts by glob pattern', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            hosts: {
              web1: { host: 'local:' },
              web2: { host: 'local:' },
            },
          },
          db: {
            hosts: {
              db1: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    const webHosts = inventory.match('web*');
    expect(webHosts).toHaveLength(2);

    const allHosts = inventory.match('*');
    expect(allHosts).toHaveLength(3);

    const exact = inventory.match('db1');
    expect(exact).toHaveLength(1);
  });

  test('hosts inherit tags from group', () => {
    const inventory: Inventory = {
      groups: {
        web: {
          tags: ['http', 'frontend'],
          hosts: {
            web1: { host: 'local:' },
            web2: { host: 'local:' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const frontend = hosts.getByTag('frontend');

    expect(frontend).toHaveLength(2);
  });

  test('host tags merge with group tags', () => {
    const inventory: Inventory = {
      groups: {
        web: {
          tags: ['http'],
          hosts: {
            web1: { host: 'local:', tags: ['primary'] },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const primary = hosts.getByTag('primary');
    const http = hosts.getByTag('http');

    expect(primary).toHaveLength(1);
    expect(http).toHaveLength(1);
  });

  test('duplicate tags are deduplicated', () => {
    const inventory: Inventory = {
      groups: {
        web: {
          tags: ['http', 'frontend'],
          hosts: {
            web1: { host: 'local:', tags: ['frontend', 'primary'] },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const all = hosts.getByTag(['http', 'frontend']);

    expect(all).toHaveLength(1);
  });

  test('caches connections for reuse', () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            hosts: {
              web1: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    const conn1 = inventory.getByName('web1');
    const conn2 = inventory.getByName('web1');

    expect(conn1).toBe(conn2);
  });

  test('throws after disposal', async () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            hosts: {
              web1: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    await inventory[Symbol.asyncDispose]();

    try {
      inventory.getAll();
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('disposed');
    }
  });

  test('safe to dispose multiple times', async () => {
    const inventory = resolveInventory(
      {
        groups: {
          web: {
            hosts: {
              web1: { host: 'local:' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    await inventory[Symbol.asyncDispose]();
    await inventory[Symbol.asyncDispose]();
  });
});
