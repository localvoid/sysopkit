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
}

/** Downloads a file from a URL using curl. */
export async function curl({
  url,
  path,
  user,
  headers,
  cookies,
  insecure,
}: CurlOptions): Promise<void> {
  let cmd = `curl`;
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
