import { describe, expect, test } from 'bun:test';
import { mockSpawn, withMockContext, MockConnector } from '@sysopkit/test-utils';
import { text } from 'node:stream/consumers';
import {
  sudo,
  SudoMiddleware,
  SUDO_PASSWORD,
  SUDO_PRESERVE_ENV,
  SUDO_ROLE,
  SUDO_USER,
} from 'sysopkit/middleware/sudo';
import { spawn } from 'sysopkit/op/exec';

describe('sudo', () => {
  test('uses ctx.vars for user', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-u', 'ctxuser', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_USER]: 'ctxuser' } },
    );
  });

  test('explicit options override ctx.vars for user', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-u', 'explicituser', '-n', 'whoami'] }]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { user: 'explicituser' },
        );
      },
      { vars: { [SUDO_USER]: 'ctxuser' } },
    );
  });

  test('uses ctx.vars for password', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: expect.arrayContaining(['-S', '-p']), stderr: '', exitCode: 0 }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_PASSWORD]: 'ctxpassword' } },
    );
  });

  test('explicit password overrides ctx.vars', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [
          { cmd: expect.arrayContaining(['-S', '-p']), stderr: '', exitCode: 0 },
          { cmd: ['sudo', '-H', '-n', 'whoami'] },
        ]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { password: 'explicitpassword' },
        );
      },
      { vars: { [SUDO_PASSWORD]: 'ctxpassword' } },
    );
  });

  test('uses ctx.vars for preserveEnv boolean', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-E', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_PRESERVE_ENV]: true } },
    );
  });

  test('uses ctx.vars for preserveEnv array', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '--preserve-env=FOO,BAR', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_PRESERVE_ENV]: ['FOO', 'BAR'] } },
    );
  });

  test('explicit preserveEnv overrides ctx.vars', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '--preserve-env=EXPLICIT', '-n', 'whoami'] }]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { preserveEnv: ['EXPLICIT'] },
        );
      },
      { vars: { [SUDO_PRESERVE_ENV]: ['CTX'] } },
    );
  });

  test('uses ctx.vars for role', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-r', 'ctxrole', '-n', 'whoami'] }]);
        await sudo(async () => {
          await spawn(['whoami']);
        });
      },
      { vars: { [SUDO_ROLE]: 'ctxrole' } },
    );
  });

  test('explicit role overrides ctx.vars', async () => {
    await withMockContext(
      async ({ conn }) => {
        mockSpawn(conn, [{ cmd: ['sudo', '-H', '-r', 'explicitrole', '-n', 'whoami'] }]);
        await sudo(
          async () => {
            await spawn(['whoami']);
          },
          { role: 'explicitrole' },
        );
      },
      { vars: { [SUDO_ROLE]: 'ctxrole' } },
    );
  });
});

/** Placeholder substituted with the actual random prompt in mock stderr. */
const PROMPT_PLACEHOLDER = '\0PROMPT\0';

interface PromptFlow {
  readonly proc: Awaited<ReturnType<SudoMiddleware['spawn']>>;
  readonly stdinReceived: () => string;
}

async function runSudoPromptFlow(
  templates: string[],
  options?: { readonly password?: string; readonly splitPromptAt?: number },
): Promise<PromptFlow> {
  const conn = new MockConnector('mock-host', 'mock', void 0);
  const password = options?.password ?? 's3cret';
  let received = '';
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  conn.spawn.mockImplementation(async (cmd: string[]) => {
    const prompt = cmd[cmd.indexOf('-p') + 1];
    let chunks = templates.map((t) => t.split(PROMPT_PLACEHOLDER).join(prompt));
    if (options?.splitPromptAt !== undefined) {
      const full = chunks.join('');
      const at = full.indexOf(prompt) + options.splitPromptAt;
      chunks = [full.slice(0, at), full.slice(at)];
    }
    return {
      stdin: new WritableStream<Uint8Array>({
        write(chunk) {
          received += decoder.decode(chunk);
        },
      }),
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('root\n'));
          controller.close();
        },
      }),
      stderr: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      }),
      exited: Promise.resolve(0),
      kill: (_code?: number) => {},
    };
  });
  const proc = await new SudoMiddleware(conn, undefined, password, undefined, undefined).spawn([
    'whoami',
  ]);
  return { proc, stdinReceived: () => received };
}

describe('sudo password prompt', () => {
  test('writes password with trailing newline and strips prompt from stderr', async () => {
    const { proc, stdinReceived } = await runSudoPromptFlow([
      `output-before${PROMPT_PLACEHOLDER}output-after`,
    ]);
    const stderr = await text(proc.stderr);
    expect(stdinReceived()).toBe('s3cret\n');
    expect(stderr).toBe('output-beforeoutput-after');
  });

  test('detects prompt split across stderr chunks', async () => {
    const { proc, stdinReceived } = await runSudoPromptFlow(
      [`output-before${PROMPT_PLACEHOLDER}output-after`],
      { splitPromptAt: 10 },
    );
    const stderr = await text(proc.stderr);
    expect(stdinReceived()).toBe('s3cret\n');
    expect(stderr).toBe('output-beforeoutput-after');
  });

  test('second prompt throws invalid sudo password with context', async () => {
    const { proc, stdinReceived } = await runSudoPromptFlow([
      `${PROMPT_PLACEHOLDER}Sorry, try again.`,
      `retry: ${PROMPT_PLACEHOLDER}`,
    ]);
    try {
      await text(proc.stderr);
      expect.unreachable();
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain('invalid sudo password');
      expect(message).toContain('whoami');
      expect(message).toContain('Sorry, try again.');
    }
    expect(stdinReceived()).toBe('s3cret\n');
  });

  test('passes stderr through when no prompt appears', async () => {
    const { proc, stdinReceived } = await runSudoPromptFlow(['some output\nmore output\n']);
    const stderr = await text(proc.stderr);
    expect(stdinReceived()).toBe('');
    expect(stderr).toBe('some output\nmore output\n');
  });

  test('flushes retained tail when stream ends without prompt', async () => {
    const { proc, stdinReceived } = await runSudoPromptFlow(['ab', 'cd']);
    const stderr = await text(proc.stderr);
    expect(stdinReceived()).toBe('');
    expect(stderr).toBe('abcd');
  });
});
