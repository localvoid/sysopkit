import type { Var } from 'sysopkit';
import { describe, expect, test } from 'bun:test';
import { withMockContext } from '@sysopkit/test-utils';
import { emitChanged, onChange, type ChangeEntry, task, utility } from 'sysopkit';

describe('changed()', () => {
  test('emits change event with single entry', async () => {
    await withMockContext(async () => {
      let received: ChangeEntry | undefined;
      const handler = async (data: unknown) => {
        received = data as ChangeEntry;
      };

      const entry = { type: 'test', resource: '/etc/config', property: 'created' };
      await onChange(handler, async () => {
        emitChanged(entry);
      });

      expect(received).toBe(entry);
    });
  });

  test('emits change event with array of entries', async () => {
    await withMockContext(async () => {
      let received: ChangeEntry[] | undefined;
      const handler = async (data: unknown) => {
        received = data as ChangeEntry[];
      };

      const entries = [
        { type: 'test', resource: 'nginx', property: 'state', from: 'absent', to: 'installed' },
        { type: 'test', resource: 'redis', property: 'state', from: 'absent', to: 'installed' },
      ];
      await onChange(handler, async () => {
        emitChanged(entries);
      });

      expect(received).toBe(entries);
    });
  });
});

describe('onChange()', () => {
  test('returns inner function result', async () => {
    await withMockContext(async () => {
      const result = await onChange(
        async () => {},
        async () => {
          return { value: 42 };
        },
      );

      expect(result).toEqual({ value: 42 });
    });
  });
});

describe('tryGet()', () => {
  test('retrieves variable from current context', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task(
        'test',
        async (ctx) => {
          expect(ctx.tryGet(VAR)).toBe('value');
        },
        { vars: { [VAR]: 'value' } },
      );
    });
  });

  test('retrieves variable from parent context', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task(
        'parent',
        async () => {
          await task('child', async (ctx) => {
            expect(ctx.tryGet(VAR)).toBe('parent-value');
          });
        },
        { vars: { [VAR]: 'parent-value' } },
      );
    });
  });

  test('retrieves variable from grandparent context', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task(
        'grandparent',
        async () => {
          await task('parent', async () => {
            await task('child', async (ctx) => {
              expect(ctx.tryGet(VAR)).toBe('grandparent-value');
            });
          });
        },
        { vars: { [VAR]: 'grandparent-value' } },
      );
    });
  });

  test('child variable shadows parent variable', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task(
        'parent',
        async () => {
          await task(
            'child',
            async (ctx) => {
              expect(ctx.tryGet(VAR)).toBe('child-value');
            },
            { vars: { [VAR]: 'child-value' } },
          );
        },
        { vars: { [VAR]: 'parent-value' } },
      );
    });
  });

  test('returns undefined for missing variable', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task('test', async (ctx) => {
        expect(ctx.tryGet(VAR)).toBeUndefined();
      });
    });
  });

  test('utility context inherits parent variables', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task(
        'parent',
        async () => {
          await utility('child', async (ctx) => {
            expect(ctx.tryGet(VAR)).toBe('parent-value');
          });
        },
        { vars: { [VAR]: 'parent-value' } },
      );
    });
  });
});

describe('get()', () => {
  test('retrieves variable from parent chain', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task(
        'parent',
        async () => {
          await task('child', async (ctx) => {
            expect(ctx.get(VAR)).toBe('parent-value');
          });
        },
        { vars: { [VAR]: 'parent-value' } },
      );
    });
  });

  test('throws when variable not found', async () => {
    await withMockContext(async () => {
      const VAR = Symbol('test.var') as Var<string>;
      await task('test', async (ctx) => {
        try {
          ctx.get(VAR);
          expect.unreachable();
        } catch (e) {
          expect((e as Error).message).toContain("context variable 'Symbol(test.var)' not found");
        }
      });
    });
  });
});
