/**
 * @module op/curl
 *
 * File download using curl.
 *
 * @see curl(1) - transfer a URL
 */

import { $_, sh } from './sh.js';

/** Configuration for curl download. */
export interface CurlOptions {
  readonly url: string;
  /** Destination file. Omit to capture stdout instead of writing a file. */
  readonly path?: string;
  readonly user?: string;
  readonly headers?: string[];
  readonly cookies?: string;
  readonly insecure?: string;
  /**
   * Fail on HTTP errors (`-f/--fail`): curl exits non-zero for HTTP
   * status >= 400 with no body written (file mode) or returned
   * (stdout mode). Without it an error page is saved to `path` (or
   * returned as stdout) with exit 0. Default false.
   */
  readonly fail?: boolean;
  /**
   * Follow redirects (`-L/--location`). Needed for mirrors and
   * short links that answer 302. Default false.
   */
  readonly followRedirects?: boolean;
  /**
   * Hide the progress meter but still show errors (`-sS`). Keeps op
   * output clean while preserving failure diagnostics. Default true;
   * pass `false` to show the progress meter.
   */
  readonly silent?: boolean;
}

/**
 * Downloads a file from a URL using curl, or captures the body as
 * stdout when `path` is omitted.
 */
export async function curl(o: CurlOptions & { path: string }): Promise<void>;
export async function curl(o: CurlOptions & { path?: undefined }): Promise<string>;
export async function curl({
  url,
  path,
  user,
  headers,
  cookies,
  insecure,
  fail,
  followRedirects,
  silent = true,
}: CurlOptions): Promise<void | string> {
  let cmd = `curl`;
  if (fail) cmd += ` -f`;
  if (followRedirects) cmd += ` -L`;
  if (silent) cmd += ` -sS`;
  if (user) cmd += ` -u ${$_(user)}`;
  if (headers) {
    for (const h of headers) {
      cmd += ` -H ${$_(h)}`;
    }
  }
  if (cookies) cmd += ` -b ${$_(cookies)}`;
  if (insecure) cmd += ` -k`;

  if (path !== undefined) {
    cmd += ` -o ${$_(path)} ${$_(url)}`;
    await sh(cmd);
    return;
  }
  const { stdout } = await sh(`${cmd} ${$_(url)}`);
  return stdout;
}
