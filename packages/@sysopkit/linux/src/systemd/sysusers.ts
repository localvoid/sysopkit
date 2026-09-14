/**
 * @module systemd/sysusers
 *
 * systemd-sysusers configuration management.
 *
 * @see sysusers.d(5) - Declarative allocation of system users and groups
 *
 * Configuration is written to: /etc/sysusers.d/{configFile}.conf
 *
 * sysusers.d is used to create system users and groups at package
 * installation or boot time. It accesses /etc/passwd and /etc/group
 * directly, bypassing NIS/LDAP.
 *
 * Note: This is for system users only, not regular "human" users.
 */

export type SysusersConf = SysusersEntry[];

/**
 * sysusers.d line types.
 *
 * - "u": Create system user and group
 * - "u!": Create system user and group with fully locked account
 * - "g": Create system group only
 * - "m": Add user to group
 * - "r": Add UID/GID range to allocation pool
 *
 * Type "u" may be suffixed with "!" (u!) to create a fully locked account,
 * which is recommended for system users to prevent non-password authentication.
 */
export type SysusersType = 'u' | 'u!' | 'g' | 'm' | 'r';

/**
 * A single sysusers.d configuration entry.
 */
export type SysusersEntry = {
  /**
   * Line type:
   * - "u": Create user and group
   * - "u!": Create user and group with fully locked account
   * - "g": Create group only
   * - "m": Add user to group
   * - "r": Add UID/GID range
   */
  type: SysusersType;

  /**
   * User or group name.
   * For "m" type: the user name.
   * For "r" type: must be "-".
   *
   * Names must: start with a-z/A-Z/_, contain only a-z/A-Z/0-9/_/-,
   * and be 1-31 characters.
   */
  name: string;

  /**
   * UID/GID or specification:
   * - Number: Specific UID/GID
   * - "-": Automatic allocation (recommended)
   * - "uid:gid" or "uid:groupname": User with specific primary group
   * - "/path/to/file": Use owner of existing file
   *
   * For "m" type: the group name to add user to.
   * For "r" type: UID/GID range (e.g., "500-900").
   */
  id?: string | number;

  /**
   * GECOS field (user description). Only for "u" type.
   */
  gecos?: string;

  /**
   * Home directory for user. Only for "u" type.
   */
  home?: string;

  /**
   * Login shell for user. Only for "u" type.
   */
  shell?: string;
};

/**
 * Parse sysusers.d configuration content into an array of entries.
 *
 * Skips comments (lines starting with #) and blank lines.
 * Each valid line has the format:
 *   Type Name [ID [GECOS [HOME [SHELL]]]]
 *
 * Only the GECOS field is quoted with double quotes per sysusers.d(5).
 * Fields are separated by whitespace (spaces or tabs).
 *
 * @param content Raw sysusers.d configuration file content
 * @returns Array of parsed SysusersEntry objects
 */
export function parseSysusersConf(content: string): SysusersConf {
  const entries: SysusersConf = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = parseSysusersLine(trimmed);
    if (!parts) {
      continue;
    }

    const [type, name, idRaw, gecos, home, shell] = parts;
    if (type !== 'u' && type !== 'u!' && type !== 'g' && type !== 'm' && type !== 'r') {
      continue;
    }

    const entry = {
      type: type as SysusersType,
      name,
      id: idRaw && idRaw !== '-' ? idRaw : void 0,
      gecos: gecos && gecos !== '-' ? gecos : void 0,
      home: home && home !== '-' ? home : void 0,
      shell: shell && shell !== '-' ? shell : void 0,
    } satisfies SysusersEntry;

    entries.push(entry);
  }

  return entries;
}

/**
 * Parse a single sysusers.d line into its constituent fields.
 * Only GECOS is quoted per sysusers.d(5); HOME and SHELL may also
 * arrive quoted and are unquoted here for tolerance.
 */
function parseSysusersLine(
  line: string,
): [string, string, string?, string?, string?, string?] | null {
  const parts: string[] = [];
  let i = 0;

  while (i < line.length && parts.length < 6) {
    while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
      i++;
    }
    if (i >= line.length) {
      break;
    }

    if (line[i] === '"') {
      let value = '';
      i++;
      while (i < line.length && line[i] !== '"') {
        value += line[i];
        i++;
      }
      if (i < line.length) {
        i++;
      }
      parts.push(value);
    } else {
      let value = '';
      while (i < line.length && line[i] !== ' ' && line[i] !== '\t') {
        value += line[i];
        i++;
      }
      parts.push(value);
    }
  }

  if (parts.length < 2) {
    return null;
  }

  return parts as [string, string, string?, string?, string?, string?];
}

/**
 * Serialize an array of SysusersEntry objects into sysusers.d configuration format.
 *
 * Each entry is output as a space-separated line:
 *   Type Name [ID [GECOS [HOME [SHELL]]]]
 *
 * Only GECOS is quoted per sysusers.d(5). Trailing undefined fields
 * are omitted (e.g., `u! httpd 404 "HTTP User"`).
 * A trailing newline is appended.
 *
 * @param entries Array of SysusersEntry objects
 * @returns Formatted sysusers.d configuration string
 */
export function serializeSysusersConf(entries: SysusersConf): string {
  const lines: string[] = [];

  for (const entry of entries) {
    const idStr =
      entry.id !== void 0 ? (typeof entry.id === 'number' ? String(entry.id) : entry.id) : '-';

    let line: string;
    if (entry.type === 'u' || entry.type === 'u!') {
      const fields = [entry.type, entry.name, idStr];
      if (entry.gecos !== void 0 || entry.home !== void 0 || entry.shell !== void 0) {
        fields.push(`"${entry.gecos ?? '-'}"`);
      }
      if (entry.home !== void 0 || entry.shell !== void 0) {
        fields.push(entry.home ?? '-');
      }
      if (entry.shell !== void 0) {
        fields.push(entry.shell);
      }
      line = fields.join(' ');
    } else if (entry.type === 'g') {
      line = `g ${entry.name} ${idStr}`;
    } else if (entry.type === 'm') {
      line = `m ${entry.name} ${idStr}`;
    } else {
      line = `r ${entry.name} ${idStr}`;
    }

    lines.push(line);
  }

  return lines.join('\n') + '\n';
}
