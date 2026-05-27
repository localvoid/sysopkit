/**
 * @module middleware/expect
 *
 * Prompt response handling.
 *
 * Provides middleware to watch for patterns in stderr and respond via stdin.
 */

import { type Connector } from '../core/connector.js';
import { type ExecutionContext } from '../core/context.js';
import { ConnectorMiddleware, middleware } from '../core/middleware.js';
import { STREAM_TRUE, TEXT_ENCODER } from '../utils/constants.js';
import { type Process } from '../utils/process.js';

/**
 * Watches stderr for a pattern and writes a response to stdin.
 *
 * Intercepts the process's stdin and stderr streams. When the pattern is detected
 * in stderr, the response is written to stdin and the matched text is removed from
 * the stderr output. Only responds once; subsequent matches are ignored.
 */
export function expectStderrPrompt<R>(
  fn: (ctx: ExecutionContext) => Promise<R>,
  options: ExpectPromptMiddlewareOptions,
): Promise<R> {
  return middleware('expect', fn, (next) => new ExpectPromptMiddleware(next, options), {
    info: () => ({
      pattern: String(options.pattern),
      response: '<hidden>',
    }),
  });
}

/** Configuration for expect prompt behavior. */
export interface ExpectPromptMiddlewareOptions {
  /** Regex or string to match against stderr output */
  readonly pattern: string | RegExp;
  /** Text to write to stdin when pattern is matched */
  readonly response: string;
}

/**
 * Middleware that watches stderr for a pattern and writes a response to stdin.
 *
 * Intercepts the process's stdin and stderr streams. When the pattern is detected
 * in stderr, the response is written to stdin and the matched text is removed from
 * the stderr output. Only responds once; subsequent matches are ignored.
 */
export class ExpectPromptMiddleware extends ConnectorMiddleware {
  /** Pattern to match in stderr output. */
  protected readonly pattern: string | RegExp;
  /** Response text to write when pattern is matched. */
  protected readonly response: string;

  constructor(next: Connector, options: ExpectPromptMiddlewareOptions) {
    super(next);
    this.pattern = options.pattern;
    this.response = options.response;
  }

  override async spawn(cmd: string[], signal?: AbortSignal): Promise<Process> {
    const proc = await super.spawn(cmd, signal);

    const procStdin = proc.stdin.getWriter();
    const stdinPromise = Promise.withResolvers();
    let stdinClosed = false;
    let stdinAborted = false;
    // Abort reason can be any value passed to stream.abort()
    let stdinAbortedReason: unknown;
    let responded = false;

    // Wraps the process stdin to defer writes until after the prompt response is sent.
    // Tracks close/abort state so pending operations can be replayed after response.
    const stdin = new WritableStream<Uint8Array>({
      async write(chunk) {
        await stdinPromise.promise;
        return procStdin.write(chunk);
      },
      close() {
        if (responded === true) {
          return procStdin.close();
        }
        stdinClosed = true;
      },
      abort(reason) {
        if (responded === true) {
          return procStdin.abort(reason);
        }
        stdinAbortedReason = reason;
        stdinAborted = true;
      },
    });

    // Intercepts stderr to detect the prompt pattern. On match, writes the response
    // to stdin, strips the matched text from stderr, and releases deferred stdin operations.
    const decoder = new TextDecoder();
    const stderrTransform = new TransformStream<Uint8Array, Uint8Array>({
      transform: async (chunk, controller) => {
        if (responded === false) {
          const text = decoder.decode(chunk, STREAM_TRUE);
          if (text.match(this.pattern)) {
            await procStdin.write(TEXT_ENCODER.encode(this.response));
            responded = true;
            stdinPromise.resolve(void 0);
            if (stdinAborted) {
              await procStdin.abort(stdinAbortedReason);
              stdinAbortedReason = void 0;
            } else if (stdinClosed) {
              await procStdin.close();
            }

            chunk = TEXT_ENCODER.encode(text.replace(this.pattern, ''));
            if (chunk.length === 0) {
              return;
            }
          }
        }
        controller.enqueue(chunk);
      },
    });

    return {
      ...proc,
      stdin,
      stderr: proc.stderr.pipeThrough(stderrTransform),
    };
  }
}
