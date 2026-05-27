/**
 * @module systemd/common
 *
 * Systemd scope - determines which instance of systemd to operate on.
 *
 * - "system": The system-wide systemd instance (PID 1)
 * - "user": The user's personal systemd instance
 */
export type SystemdScope = 'system' | 'user';

/**
 * Common options for systemd operations that support both system and user scopes.
 */
export interface SystemdScopeOptions {
  /**
   * Whether to operate on system or user systemd.
   * Default: "system"
   */
  readonly scope?: SystemdScope;

  /**
   * Username for user-scope operations.
   * Used to determine the correct home directory path.
   * Only relevant when scope="user".
   */
  readonly user?: string;
}

/**
 * Default path for system unit files.
 */
export const SYSTEMD_SYSTEM_PATH = '/etc/systemd/system';

/**
 * Relative path for user unit files (from home directory).
 */
export const SYSTEMD_USER_PATH = '.config/systemd/user';

/**
 * Get the path to a unit file.
 *
 * @param name - Unit name including type suffix (e.g., "nginx.service")
 * @param options - Scope options
 * @returns Absolute path to the unit file
 */
export function getUnitPath(name: string, options?: SystemdScopeOptions): string {
  const scope = options?.scope ?? 'system';

  if (scope === 'user') {
    if (options?.user) {
      return `/home/${options.user}/${SYSTEMD_USER_PATH}/${name}`;
    }
    return `${SYSTEMD_USER_PATH}/${name}`;
  }

  return `${SYSTEMD_SYSTEM_PATH}/${name}`;
}

/**
 * Get the path to a systemd daemon configuration file.
 *
 * @param configName - Configuration file name (e.g., "journald.conf")
 * @param options - Options including user for user-scope paths
 * @returns Absolute path to the configuration file
 */
export function getSystemdConfigPath(configName: string, options?: { user?: string }): string {
  if (options?.user) {
    return `/home/${options.user}/.config/systemd/${configName}`;
  }
  return `/etc/systemd/${configName}`;
}

/**
 * Get the path to a drop-in configuration file for a daemon config.
 *
 * @param configName - Configuration file name (e.g., "journald.conf")
 * @param dropInName - Drop-in name (e.g., "sysops")
 * @returns Absolute path to the drop-in file
 */
export function getSystemdConfigDropInPath(configName: string, dropInName: string): string {
  return `/etc/systemd/${configName}.d/${dropInName}.conf`;
}

/**
 * Parse the output of `systemctl show` into a key-value record.
 *
 * The output format is one property per line: "PropertyName=value"
 *
 * @param output - Raw output from systemctl show
 * @returns Record mapping property names to their values
 */
export function parseKeyValue(output: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of output.split('\n')) {
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex);
    const value = line.slice(eqIndex + 1);
    result[key] = value;
  }

  return result;
}
