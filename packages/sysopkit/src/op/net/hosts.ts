/**
 * @module op/net/hosts
 *
 * `/etc/hosts` operations.
 *
 * @see hosts(5) - hostname lookup file format
 *
 * The hosts file format:
 * - # comment
 * - Blank lines are ignored
 * - Entry format: IP_address canonical_hostname [aliases...]
 * - Fields are separated by whitespace (spaces or tabs)
 *
 * Example:
 * ```
 * # Static hostname lookup
 * 127.0.0.1       localhost
 * ::1             localhost ip6-localhost
 * 192.168.1.10    server1 server1.local
 * ```
 */
export const HOSTS_PATH = '/etc/hosts';

export type Hosts = HostsEntry[];

export interface HostsEntry {
  readonly ip: string;
  readonly hostnames: string[];
}

export function parseHosts(content: string): Hosts {
  const entries: HostsEntry[] = [];

  for (const line of content.split('\n')) {
    // Removes comments
    const t = line.replaceAll(/#.*$/g, '').trim();

    if (t === '') {
      continue;
    }

    const parts = t.split(/\s+/);
    if (parts.length < 2) {
      continue;
    }

    entries.push({ ip: parts[0], hostnames: parts.slice(1) });
  }

  return entries;
}

export function serializeHosts(entries: HostsEntry[]): string {
  let s = '';
  for (const entry of entries) {
    s += `${entry.ip}\t\t${entry.hostnames.join(' ')}\n`;
  }

  return s;
}
