/**
 * @module limits
 *
 * Resource limits configuration management for /etc/security/limits.conf.
 *
 * @see limits.conf(5) - configuration file for setting user resource limits
 *
 * The limits.conf fo_rmat is:
 * <domain> <type> <item> <value>
 *
 * - domain: username, @groupname, * (wildcard), %group (maxlogins only)
 * - type: soft, hard, - (both)
 * - item: core, data, fsize, memlock, nofile, rss, nproc, stack, etc.
 * - value: numeric or "unlimited"
 *
 * Example:
 * ```
 * # Set max open files for all users
 * * soft nofile 65535
 * * hard nofile 65535
 *
 * # Set max processes for web user
 * @web soft nproc 100
 * @web hard nproc 200
 * ```
 */

/** Resource limit entries for limits.conf configuration. */
export type LimitsConf = LimitsEntry[];

/** A single resource limit rule. */
export interface LimitsEntry {
  readonly domain: string;
  readonly limitType: 'soft' | 'hard' | '-';
  readonly item: string;
  readonly value: string;
}

/**
 * Parses limits.conf content into structured entries.
 *
 * Ignores comments and blank lines. Validates limit type values.
 */
export function parseLimitsConf(content: string): LimitsEntry[] {
  const result: LimitsEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) {
      continue;
    }

    const [domain, limitType, item, ...valueParts] = parts;
    const value = valueParts.join(' ');

    if (limitType === 'soft' || limitType === 'hard' || limitType === '-') {
      result.push({
        domain,
        limitType,
        item,
        value,
      });
    }
  }

  return result;
}

/**
 * Serializes limit entries into limits.conf format.
 */
export function serializeLimitsConf(entries: LimitsEntry[]): string {
  let s = '';
  for (const entry of entries) {
    s += `${entry.domain} ${entry.limitType} ${entry.item} ${entry.value}\n`;
  }
  return s;
}
