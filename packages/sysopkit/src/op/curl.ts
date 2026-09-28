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
  readonly path: string;
  readonly user?: string;
  readonly headers?: string[];
  readonly cookies?: string;
  readonly insecure?: string;
  /**
   * Fail on HTTP errors (`-f/--fail`): no body is written and curl
   * exits non-zero for HTTP status >= 400. Without it an error page
   * is saved to `path` with exit 0. Default false.
   */
  readonly fail?: boolean;
  /**
   * Follow redirects (`-L/--location`). Needed for mirrors and
   * short links that answer 302. Default false.
   */
  readonly followRedirects?: boolean;
  /**
   * Hide the progress meter but still show errors (`-sS`). Keeps op
   * output clean while preserving failure diagnostics. Default false.
   */
  readonly silent?: boolean;
}

/** Downloads a file from a URL using curl. */
export async function curl({
  url,
  path,
  user,
  headers,
  cookies,
  insecure,
  fail,
  followRedirects,
  silent,
}: CurlOptions): Promise<void> {
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

  cmd += ` -o ${$_(path)} ${$_(url)}`;
  await sh(cmd);
}
