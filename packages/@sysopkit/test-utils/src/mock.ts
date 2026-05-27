import { expect, type Mock, mock } from 'bun:test';
import {
  apply,
  context,
  ConnectorBase,
  createRootContext,
  runWithContext,
  CHANGE_EVENT,
  type Connector,
  type Event,
  type Verbosity,
  type Reporter,
  type ExecutionContext,
  type Process,
} from 'sysopkit';

const TEXT_DECODER = new TextDecoder();

export class MockReporter implements Reporter {
  ctxStart: Mock<(ctx: ExecutionContext) => void> = mock<Reporter['ctxStart']>(() => {});
  ctxEnd: Mock<(ctx: ExecutionContext) => void> = mock<Reporter['ctxEnd']>(() => {});
  ctxError: Mock<(ctx: ExecutionContext, error: any) => void> = mock<Reporter['ctxError']>(
    () => {},
  );
  spawn: Mock<(ctx: ExecutionContext, cmd: string[]) => void> = mock<Reporter['spawn']>(() => {});
  onEvent: Mock<<T>(ctx: ExecutionContext, event: Event<T>, data: T) => void> = mock<
    Reporter['onEvent']
  >(() => {});
  retryAttempt: Mock<(ctx: ExecutionContext, attempt: number, delay: number, error: any) => void> =
    mock<Reporter['retryAttempt']>(() => {});
  info: Mock<(ctx: ExecutionContext, message: string) => void> = mock<Reporter['info']>(() => {});
  warn: Mock<(ctx: ExecutionContext, message: string) => void> = mock<Reporter['warn']>(() => {});
  error: Mock<(ctx: ExecutionContext, message: string) => void> = mock<Reporter['error']>(() => {});
}

export class MockConnector extends ConnectorBase {
  override readonly rsh: string[] = [] as const;

  spawn: Mock<(cmd: string[], signal?: AbortSignal) => Promise<Process>> = mock<Connector['spawn']>(
    () => {
      throw new Error('exec not configured - use mockSpawn()');
    },
  );
}

export interface MockContextOptions {
  readonly dryRun?: boolean;
  readonly reporter?: Reporter;
  readonly vars?: Record<string, any>;
  readonly verbosity?: Verbosity;
  readonly signal?: AbortSignal;
}

export interface MockContext {
  readonly ctx: ExecutionContext;
  readonly conn: MockConnector;
  readonly reporter: MockReporter;
  readonly abortController: AbortController;
}

export async function withMockContext<R>(
  fn: (mock: MockContext) => Promise<R>,
  options?: MockContextOptions,
): Promise<R> {
  const abortController = new AbortController();
  const reporter = new MockReporter();
  const conn = new MockConnector('mock-host', 'mock', void 0);
  const dryRun = options?.dryRun ?? false;
  const signal = options?.signal ? AbortSignal.any([options.signal]) : abortController.signal;
  const ctx = createRootContext(reporter, dryRun, options?.vars ?? {}, signal);
  const result = await runWithContext(abortController, ctx, async (ctx) => {
    return apply('test', conn, async () => {
      return fn({ ctx, conn, reporter, abortController });
    });
  });
  return result.result;
}

export interface MockSpawnSpec {
  readonly cmd: any;
  readonly stdin?: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}

export function mockSpawn(connector: MockConnector, specs: MockSpawnSpec[]): void {
  let index = 0;
  connector.spawn.mockImplementation((async (cmd: string[]) => {
    const spec = specs[index];
    if (!spec) throw new Error(`Unexpected exec call ${index}: ${cmd.join(' ')}`);
    try {
      expect(cmd).toEqual(spec.cmd);
    } catch (e) {
      Error.stackTraceLimit = 50;
      throw e;
    }

    const expectedStdin = spec.stdin;
    let receivedStdin = '';
    const stdin = new WritableStream(
      expectedStdin
        ? {
            write(chunk) {
              receivedStdin += TEXT_DECODER.decode(chunk);
            },
            close() {
              expect(receivedStdin).toBe(expectedStdin);
            },
          }
        : void 0,
    );

    index++;
    const encoder = new TextEncoder();
    return {
      stdin,
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(spec.stdout ?? ''));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(spec.stderr ?? ''));
          controller.close();
        },
      }),
      exited: Promise.resolve(spec.exitCode ?? 0),
      kill: (_code) => {},
    };
  }) as Connector['spawn']);
}

export function getSpawnCalls(connector: MockConnector): string[][] {
  return connector.spawn.mock.calls.map((call) => call[0]);
}

export interface ChangedTracker {
  get changed(): boolean;
}

export function trackChanged(): ChangedTracker {
  let changed = false;
  context().on(CHANGE_EVENT, async () => {
    changed = true;
  });
  return {
    get changed() {
      return changed;
    },
  };
}
