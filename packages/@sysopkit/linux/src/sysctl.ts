/**
 * @module sysctl
 *
 * sysctl.conf configuration management for kernel parameters.
 *
 * @see sysctl.conf(5) - sysctl configuration file
 * @see sysctl.d(5) - sysctl configuration directory
 *
 * The sysctl.conf format is a simple key=value format:
 * - Comments start with # or ;
 * - Blank lines are ignored
 * - Settings are: key = value (spaces around = are optional)
 *
 * Example:
 * ```
 * # Network settings
 * net.ipv4.ip_forward = 1
 * net.core.somaxconn = 65535
 * ```
 */

export const SYSCTL_CONF_PATH = '/etc/sysctl.conf';
export const SYSCTL_DROP_IN_PATH = '/etc/sysctl.d';

/** Kernel parameter configuration as key-value pairs. */
export interface SysctlConf {
  readonly [key: string]: string;
}

/**
 * Parses sysctl.conf content into key-value pairs.
 *
 * Ignores comments (lines starting with # or ;) and blank lines.
 */
export function parseSysctlConf(content: string): SysctlConf {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Serializes kernel parameters into sysctl.conf format.
 */
export function serializeSysctlConf(data: SysctlConf): string {
  let s = '';
  for (const [key, value] of Object.entries(data)) {
    s += `${key} = ${value}\n`;
  }
  return s;
}
