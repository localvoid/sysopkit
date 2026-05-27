import { describe, expect, test } from 'bun:test';
import { apply } from 'sysopkit';
import { LocalConnector } from 'sysopkit/connector/local';
import { resolveInventory, type ConnectorFactory, type Inventory } from 'sysopkit/inventory';
import { start } from 'sysopkit/start';

const local: ConnectorFactory = () => new LocalConnector();

const INVENTORY: Inventory = {
  groups: {
    default: {
      hosts: {
        localhost: { host: 'local:' },
      },
    },
  },
};

describe('start', () => {
  test('dry-run flag is passed to context', async () => {
    const result = await start(
      async () => {
        await using hosts = resolveInventory(INVENTORY, { connectors: { local } });
        await apply('test', hosts.getAll(), async (ctx) => {
          expect(ctx.dryRun).toBe(true);
        });
      },
      { dryRun: true },
    );

    expect(result.success).toBe(true);
  });

  test('returns error on failure', async () => {
    const result = await start(async () => {
      throw new Error('test error');
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect((result.error as Error).message).toBe('test error');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    }
  });

  test('returns result and duration on success', async () => {
    const result = await start(async () => {
      return 'test result';
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result).toBe('test result');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('connector errors', () => {
  test('empty ssh prefix throws error', async () => {
    const inventory: Inventory = {
      groups: {
        default: {
          hosts: {
            testhost: { host: 'ssh:' },
          },
        },
      },
    };

    await start(async () => {
      await using hosts = resolveInventory(inventory);
      expect(() => hosts.getAll()).toThrow(Error);
      expect(() => hosts.getAll()).toThrow('requires a host');
    });
  });
});
