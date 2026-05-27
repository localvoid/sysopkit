/**
 * @module sudoers
 *
 * Sudoers file format serializer.
 *
 * Format: user host = (runas) commands
 *
 * @see sudoers(5) - sudoers file format
 */

export const SUDOERS_CONF_PATH = '/etc/sudoers';
export const SUDOERS_DROP_IN_PATH = '/etc/sudoers.d';

/** Sudoers rule defining user access to commands. */
export interface SudoersConfRule {
  readonly user: string;
  readonly hosts: string[];
  readonly runas?: string;
  readonly commands: string[];
  readonly nopasswd?: boolean;
}

/** Sudoers configuration as a list of rules. */
export type SudoersConf = SudoersConfRule[];

/**
 * Serializes sudoers rules into sudoers file format.
 *
 * Each rule is formatted as: user hosts = (runas) NOPASSWD: commands
 */
export function serializeSudoersConf(rules: SudoersConf): string {
  let s = '';
  for (const rule of rules) {
    const user = rule.user;
    const hosts = rule.hosts.join(', ');
    const runas = rule.runas ? `(${rule.runas}) ` : '';
    const nopasswd = rule.nopasswd ? 'NOPASSWD: ' : '';
    const commands = rule.commands.join(', ');

    s += `${user} ${hosts} = ${runas}${nopasswd}${commands}\n`;
  }

  return s;
}
