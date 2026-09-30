import { describe, expect, test } from 'bun:test';
import { MockReporter } from '@sysopkit/test-utils';
import { apply, VERBOSITY_DEBUG } from 'sysopkit';
import { LocalConnector } from 'sysopkit/connector/local';
import { resolveInventory, type ConnectorFactory, type Inventory } from 'sysopkit/inventory';
import { main, start } from 'sysopkit/start';

function expectExitCode(expected: number): void {
  expect(process.exitCode as unknown as number).toBe(expected);
}

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
    const result = await start(
      async () => {
        return 'test result';
      },
      { reporter: new MockReporter() },
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result).toBe('test result');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('main', () => {
  test('sets exit code 0 on success and returns result', async () => {
    const prev = process.exitCode;
    process.exitCode = void 0;
    try {
      const result = await main(
        async () => {
          return 'ok';
        },
        { reporter: new MockReporter() },
      );

      expect(result.success).toBe(true);
      expectExitCode(0);
    } finally {
      process.exitCode = prev;
    }
  });

  test('sets exit code 1 on failure and returns error', async () => {
    const prev = process.exitCode;
    process.exitCode = void 0;
    try {
      const result = await main(
        async () => {
          throw new Error('boom');
        },
        { reporter: new MockReporter() },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect((result.error as Error).message).toBe('boom');
      }
      expectExitCode(1);
    } finally {
      process.exitCode = prev;
    }
  });

  test('preserves a pre-existing non-zero exit code on success', async () => {
    const prev = process.exitCode;
    process.exitCode = 2;
    try {
      const result = await main(
        async () => {
          return 'ok';
        },
        { reporter: new MockReporter() },
      );

      expect(result.success).toBe(true);
      expectExitCode(2);
    } finally {
      process.exitCode = prev;
    }
  });

  test('rethrows at debug verbosity via env', async () => {
    const prevExit = process.exitCode;
    const prevVerb = process.env['SYSOPKIT_VERBOSITY'];
    process.exitCode = void 0;
    process.env['SYSOPKIT_VERBOSITY'] = 'debug';
    try {
      try {
        await main(
          async () => {
            throw new Error('debug boom');
          },
          { reporter: new MockReporter() },
        );
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('debug boom');
      }
      expectExitCode(1);
    } finally {
      process.exitCode = prevExit;
      if (prevVerb === void 0) {
        delete process.env['SYSOPKIT_VERBOSITY'];
      } else {
        process.env['SYSOPKIT_VERBOSITY'] = prevVerb;
      }
    }
  });

  test('rethrows when custom reporter verbosity is debug', async () => {
    const prevExit = process.exitCode;
    const prevVerb = process.env['SYSOPKIT_VERBOSITY'];
    process.exitCode = void 0;
    delete process.env['SYSOPKIT_VERBOSITY'];
    try {
      const reporter = Object.assign(new MockReporter(), { verbosity: VERBOSITY_DEBUG });
      try {
        await main(
          async () => {
            throw new Error('reporter debug boom');
          },
          { reporter },
        );
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('reporter debug boom');
      }
      expectExitCode(1);
    } finally {
      process.exitCode = prevExit;
      if (prevVerb !== void 0) {
        process.env['SYSOPKIT_VERBOSITY'] = prevVerb;
      }
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
