import { describe, expect, test } from 'bun:test';
import { LocalConnector } from 'sysopkit/connector/local';
import { SSHConnector } from 'sysopkit/connector/ssh';
import {
  resolveInventory,
  type BaseHostConfig,
  type ConnectorFactory,
  type Inventory,
  type SshHostConfig,
} from 'sysopkit/inventory';

const localConnector: ConnectorFactory = () => new LocalConnector();

/** Test-only combination: built-in SSH plus the local stub. */
interface LocalHostConfig extends BaseHostConfig {
  readonly type: 'local';
}

type TestHosts = SshHostConfig | LocalHostConfig;

describe('resolveInventory', () => {
  test('creates connected inventory from simple inventory', () => {
    const inventory: Inventory<TestHosts> = {
      groups: {
        web: {
          hosts: {
            server1: { type: 'local' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const all = hosts.getAll();

    expect(all).toHaveLength(1);
  });

  test('uses host name as host address when not specified', () => {
    const inventory: Inventory<TestHosts> = {
      groups: {
        web: {
          hosts: {
            myserver: { type: 'local' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const all = hosts.getAll();

    expect(all).toHaveLength(1);
  });

  test('resolves multiple groups', () => {
    const inventory: Inventory<TestHosts> = {
      groups: {
        web: {
          hosts: {
            web1: { type: 'local' },
            web2: { type: 'local' },
          },
        },
        db: {
          hosts: {
            db1: { type: 'local' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const all = hosts.getAll();

    expect(all).toHaveLength(3);
  });

  test('returns empty for empty groups', () => {
    const inventory: Inventory<TestHosts> = { groups: {} };

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
              web1: { type: 'local' },
              web2: { type: 'local' },
            },
          },
          db: {
            hosts: {
              db1: { type: 'local' },
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
              web1: { type: 'local' },
              web2: { type: 'local' },
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
              web1: { type: 'local' },
              web2: { type: 'local' },
            },
          },
          db: {
            tags: ['backend'],
            hosts: {
              db1: { type: 'local' },
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
            hosts: { web1: { type: 'local' } },
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
              web1: { type: 'local', tags: ['primary'] },
              web2: { type: 'local' },
            },
          },
          db: {
            tags: ['backend'],
            hosts: {
              db1: { type: 'local', tags: ['primary'] },
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
              web1: { type: 'local' },
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
              web1: { type: 'local' },
              web2: { type: 'local' },
            },
          },
          db: {
            hosts: {
              db1: { type: 'local' },
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
    const inventory: Inventory<TestHosts> = {
      groups: {
        web: {
          tags: ['http', 'frontend'],
          hosts: {
            web1: { type: 'local' },
            web2: { type: 'local' },
          },
        },
      },
    };

    const hosts = resolveInventory(inventory, { connectors: { local: localConnector } });
    const frontend = hosts.getByTag('frontend');

    expect(frontend).toHaveLength(2);
  });

  test('host tags merge with group tags', () => {
    const inventory: Inventory<TestHosts> = {
      groups: {
        web: {
          tags: ['http'],
          hosts: {
            web1: { type: 'local', tags: ['primary'] },
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
    const inventory: Inventory<TestHosts> = {
      groups: {
        web: {
          tags: ['http', 'frontend'],
          hosts: {
            web1: { type: 'local', tags: ['frontend', 'primary'] },
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
              web1: { type: 'local' },
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
              web1: { type: 'local' },
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
              web1: { type: 'local' },
            },
          },
        },
      },
      { connectors: { local: localConnector } },
    );

    await inventory[Symbol.asyncDispose]();
    await inventory[Symbol.asyncDispose]();
  });

  test('passes strictHostKeyChecking through to SSH connectors', () => {
    const inventory = resolveInventory({
      groups: {
        lab: {
          hosts: {
            strict: { host: '192.168.122.100', options: { strictHostKeyChecking: false } },
            plain: { host: '192.168.122.101' },
          },
        },
      },
    });

    const strict = inventory.getByName('strict');
    expect(strict).toBeInstanceOf(SSHConnector);
    expect((strict as SSHConnector).strictHostKeyChecking).toBe(false);

    const plain = inventory.getByName('plain');
    expect(plain).toBeInstanceOf(SSHConnector);
    expect((plain as SSHConnector).strictHostKeyChecking).toBeUndefined();
  });

  test('merges options over resolved fields', () => {
    const inventory = resolveInventory({
      groups: {
        lab: {
          hosts: {
            edge: {
              host: '192.168.122.100',
              options: { user: 'admin', timeout: 30, strictHostKeyChecking: false },
            },
          },
        },
      },
    });

    const conn = inventory.getByName('edge');
    expect(conn).toBeInstanceOf(SSHConnector);
    expect((conn as SSHConnector).user).toBe('admin');
    expect((conn as SSHConnector).timeout).toBe(30);
    expect((conn as SSHConnector).strictHostKeyChecking).toBe(false);
  });

  test('rejects unknown host types', () => {
    expect(() =>
      resolveInventory({
        groups: {
          lab: {
            hosts: {
              edge: { host: '192.168.122.100', type: 'nope' },
            },
          },
        },
      }),
    ).toThrow("unknown host type 'nope' for host 'edge'");
  });

  test('defaults bare hosts to SSH by name', () => {
    const inventory = resolveInventory({ groups: { lab: { hosts: { edge: {} } } } });

    const conn = inventory.getByName('edge');
    expect(conn).toBeInstanceOf(SSHConnector);
  });
});
