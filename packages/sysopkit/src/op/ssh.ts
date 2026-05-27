/**
 * @module op/ssh
 *
 * SSH configuration file operations for sshd_config and known_hosts.
 *
 * @see sshd_config(5) - OpenSSH daemon configuration file
 * @see sshd(8) - SSH_KNOWN_HOSTS FILE FORMAT
 */

/** Path to the SSH daemon configuration file. */
export const SSHD_CONF_PATH = '/etc/ssh/sshd_config';

/** Path to the user's known hosts file. */
export const KNOWN_HOSTS_PATH = '~/.ssh/known_hosts';

/** Parsed SSH daemon configuration data. */
export interface SshdConf {
  /**
   * Port number that sshd listens on.
   *
   * Default: 22
   */
  readonly port?: number | number[];
  /**
   * Local addresses sshd should listen on. Supports hostname, IPv4, and IPv6 forms with optional
   * port and rdomain.
   *
   * Default: all local addresses on the default routing domain
   */
  readonly listenAddress?: string | string[];
  /**
   * Global options.
   */
  readonly options?: SshdConfOptions;
  /**
   * Configures an external subsystem.
   */
  readonly subsystem?: Record<string, string[]>;
  /**
   * Match blocks.
   */
  readonly match?: Record<string, SshdConfOptions>;
}

export type SshdConfValue = boolean | number | string | (boolean | number | string)[];

/** SSH daemon configuration options. */
export interface SshdConfOptions {
  /**
   * Environment variables the client may send. Names may contain '*' and '?' wildcards. Multiple
   * directives append.
   *
   * Default: none
   */
  readonly AcceptEnv?: string[];
  /**
   * Address family to use: any, inet (IPv4 only), or inet6 (IPv6 only).
   *
   * Default: any
   */
  readonly AddressFamily?: 'any' | 'inet' | 'inet6';
  /**
   * Whether ssh-agent forwarding is permitted.
   *
   * Default: yes
   */
  readonly AllowAgentForwarding?: boolean;
  /**
   * Group name patterns allowed to log in. Only group names are valid; numerical GIDs are not
   * recognized. Multiple directives append.
   *
   * Default: all groups
   */
  readonly AllowGroups?: string[];
  /**
   * Whether StreamLocal (Unix-domain socket) forwarding is permitted.
   *
   * Default: yes
   */
  readonly AllowStreamLocalForwarding?: boolean | 'all' | 'local' | 'remote';
  /**
   * Whether TCP forwarding is permitted.
   *
   * Default: yes
   */
  readonly AllowTcpForwarding?: boolean | 'all' | 'local' | 'remote';
  /**
   * User name patterns allowed to log in. Patterns may use `USER@HOST` form with CIDR addresses.
   * Multiple directives append.
   *
   * Default: all users
   */
  readonly AllowUsers?: string[];
  /**
   * Authentication methods required for access. One or more comma-separated lists, or "any" for
   * the default single-method behaviour. Each method listed must also be explicitly enabled.
   */
  readonly AuthenticationMethods?: 'any' | (string & {});
  /**
   * Program used to look up the user's public keys. Must be owned by root, not
   * group/world-writable, and specified by absolute path. Supports tokens.
   *
   * Default: none
   */
  readonly AuthorizedKeysCommand?: 'none' | (string & {});
  /**
   * User account under which AuthorizedKeysCommand is run. Required when `AuthorizedKeysCommand`
   * is specified.
   */
  readonly AuthorizedKeysCommandUser?: string;
  /**
   * Files containing public keys for user authentication. May include wildcards and tokens.
   * Relative paths are resolved from the user's home directory. Set to "none" to skip.
   *
   * Default: .ssh/authorized_keys .ssh/authorized_keys2.
   */
  readonly AuthorizedKeysFile?: 'none' | (string & {}) | string[];
  /**
   * Program used to generate the list of allowed certificate principals. Must be owned by root,
   * not group/world-writable, and specified by absolute path. Supports tokens.
   *
   * Default: none
   */
  readonly AuthorizedPrincipalsCommand?: string;
  /**
   * User account under which AuthorizedPrincipalsCommand is run. Required when
   * `AuthorizedPrincipalsCommand` is specified.
   */
  readonly AuthorizedPrincipalsCommandUser?: string;
  /**
   * File listing principal names accepted for certificate authentication. May include wildcards
   * and tokens. Set to "none" to not use a principals file.
   *
   * Default: none. */
  readonly AuthorizedPrincipalsFile?: string;
  /**
   * File whose contents are sent to the remote user before authentication is allowed. Set to
   * "none" for no banner.
   *
   * Default: no banner.
   */
  readonly Banner?: string;
  /**
   * Algorithms allowed for signing certificates by CAs. Prefix with '+' to append, '-' to remove,
   * or '^' to prepend to the default set.
   */
  readonly CASignatureAlgorithms?: string | string[];
  /**
   * Inactivity timeouts for SSH channels as "type=interval" pairs. Special "global" timeout
   * applies to all active channels. Interval uses time format (e.g. "5m"). Zero disables.
   *
   * Default: no timeout.
   */
  readonly ChannelTimeout?: string | string[];
  /**
   * Whether to allow keyboard-interactive authentication.
   * @deprecated Use KbdInteractiveAuthentication instead.
   */
  readonly ChallengeResponseAuthentication?: boolean;
  /**
   * Directory to chroot(2) into after authentication. All path components must be root-owned and
   * not group/world-writable. Supports tokens.
   *
   * Default: none (no chroot).
   */
  readonly ChrootDirectory?: string;
  /**
   * Ciphers allowed for connection encryption, comma-separated. Prefix with '+' to append, '-' to
   * remove, or '^' to prepend to the default set.
   */
  readonly Ciphers?: string | string[];
  /**
   * Number of client alive messages that may be sent without response before disconnecting. Zero
   * disables connection termination.
   *
   * Default: 3.
   */
  readonly ClientAliveCountMax?: number;
  /**
   * Interval in seconds after which sshd sends a client alive message if no data has been
   * received. Zero disables.
   *
   * Default: 0
   */
  readonly ClientAliveInterval?: number;
  /**
   * Whether compression is enabled after authentication. "delayed" is a legacy synonym for yes.
   *
   * Default: yes
   */
  readonly Compression?: boolean | 'delayed';
  /**
   * Group name patterns denied login. Only group names are valid; numerical GIDs are not
   * recognized. Multiple directives append.
   *
   * Default: none denied
   */
  readonly DenyGroups?: string[];
  /**
   * User name patterns denied login. Patterns may use `USER@HOST` form with CIDR addresses.
   * Multiple directives append.
   *
   * Default: none denied
   */
  readonly DenyUsers?: string[];
  /**
   * Disables all forwarding features including X11, ssh-agent, TCP, and StreamLocal. Overrides all
   * other forwarding-related options.
   */
  readonly DisableForwarding?: boolean;
  /**
   * Writes a temporary file listing authentication methods and credentials used, exposed via
   * SSH_USER_AUTH environment variable.
   *
   * Default: no */
  readonly ExposeAuthInfo?: boolean;
  /**
   * Hash algorithm used when logging key fingerprints.
   *
   * Default: sha256.
   */
  readonly FingerprintHash?: 'md5' | 'sha256';
  /**
   * Forces a command to be run, ignoring the client's supplied command and ~/.ssh/rc. The original
   * command is available in SSH_ORIGINAL_COMMAND. "internal-sftp" forces the in-process SFTP
   * server.
   *
   * Default: none. */
  readonly ForceCommand?: string;
  /**
   * Whether remote hosts may connect to ports forwarded for the client. "clientspecified" allows
   * the client to choose the bind address.
   *
   * Default: no
   */
  readonly GatewayPorts?: boolean | 'clientspecified';
  /**
   * Whether GSSAPI-based user authentication is allowed.
   *
   * Default: no
   */
  readonly GSSAPIAuthentication?: boolean;
  /**
   * Whether to automatically destroy the user's credentials cache on logout.
   *
   * Default: yes
   */
  readonly GSSAPICleanupCredentials?: boolean;
  /**
   * Whether to look at .k5users file for GSSAPI authentication access control.
   *
   * Default: no
   */
  readonly GSSAPIEnablek5users?: boolean;
  /**
   * Comma-separated authentication indicator names that control GSSAPI access. Prefixed with '!' to
   * deny. At least one non-negated indicator must be present in the Kerberos ticket.
   *
   * Default: no indicators used
   */
  readonly GSSAPIIndicators?: string | string[];
  /**
   * Key exchange algorithms accepted for GSSAPI key exchange. Only applies to connections using
   * GSSAPI.
   */
  readonly GSSAPIKexAlgorithms?: string | string[];
  /**
   * Whether key exchange based on GSSAPI is allowed.
   *
   * Default: no.
   */
  readonly GSSAPIKeyExchange?: boolean;
  /**
   * Whether to be strict about the GSSAPI acceptor identity. When no, the client may authenticate
   * against any service key in the default store.
   *
   * Default: yes
   */
  readonly GSSAPIStrictAcceptorCheck?: boolean;
  /**
   * Whether to update the user's GSSAPI credentials after a successful rekey. Requires
   * GSSAPIKeyExchange enabled on both server and client.
   *
   * Default: no
   */
  readonly GSSAPIStoreCredentialsOnRekey?: boolean;
  /**
   * Signature algorithms accepted for host-based authentication, comma-separated. Prefix with '+'
   * to append, '-' to remove, or '^' to prepend to the default set.
   */
  readonly HostbasedAcceptedAlgorithms?: string | string[];
  /**
   * Signature algorithms accepted for host-based authentication.
   * @deprecated Use HostbasedAcceptedAlgorithms instead.
   */
  readonly HostbasedAcceptedKeyTypes?: string | string[];
  /**
   * Whether rhosts or /etc/hosts.equiv authentication together with public key client host
   * authentication is allowed.
   *
   * Default: no
   */
  readonly HostbasedAuthentication?: boolean;
  /**
   * Whether sshd uses the name supplied by the client rather than attempting a reverse name lookup
   * during host-based authentication.
   *
   * Default: no
   */
  readonly HostbasedUsesNameFromPacketOnly?: boolean;
  /**
   * File containing a public host certificate. The certificate's public key must match a private
   * host key specified by HostKey. Multiple directives allowed.
   *
   * Default: no certificates.
   */
  readonly HostCertificate?: string | string[];
  /**
   * File containing a private host key used by SSH. Multiple directives allowed. Public host key
   * files may also be specified, delegating private key operations to an agent.
   */
  readonly HostKey?: string | string[];
  /**
   * UNIX-domain socket used to communicate with an agent that has access to private host keys. Set
   * to "SSH_AUTH_SOCK" to read the socket from the environment variable.
   */
  readonly HostKeyAgent?: string;
  /**
   * Host key signature algorithms the server offers, comma-separated. Prefix with '+' to append,
   * '-' to remove, or '^' to prepend to the default set.
   */
  readonly HostKeyAlgorithms?: string | string[];
  /**
   * Whether to ignore per-user .rhosts and .shosts files during host-based authentication.
   * "shosts-only" allows .shosts but ignores .rhosts.
   *
   * Default: yes
   */
  readonly IgnoreRhosts?: boolean | 'shosts-only';
  /**
   * Whether to ignore the user's ~/.ssh/known_hosts during host-based authentication, using only
   * the system-wide known hosts file.
   *
   * Default: no.
   */
  readonly IgnoreUserKnownHosts?: boolean;
  /**
   * Configuration file(s) to include. May contain glob wildcards, processed in lexical order.
   * Relative paths are assumed to be in /etc/ssh. May appear inside a Match block.
   */
  readonly Include?: string | string[];
  /**
   * IPv4 type-of-service or DSCP class for the connection. One or two values: the first for
   * interactive sessions, the second for non-interactive. Accepts DSCP class names (af11-cs7, ef,
   * le), lowdelay, throughput, reliability, a numeric value, or none.
   *
   * Default: af21 cs1.
   */
  readonly IPQoS?: string | string[];
  /**
   * Whether to allow keyboard-interactive authentication. All authentication styles from
   * `login.conf(5)` are supported.
   *
   * Default: yes
   */
  readonly KbdInteractiveAuthentication?: boolean;
  /**
   * Whether password authentication is validated through the Kerberos KDC. Requires a Kerberos
   * servtab.
   *
   * Default: no
   */
  readonly KerberosAuthentication?: boolean;
  /**
   * Whether to attempt to acquire an AFS token before accessing the user's home directory when AFS
   * is active and the user has a Kerberos 5 TGT.
   *
   * Default: no
   */
  readonly KerberosGetAFSToken?: boolean;
  /**
   * Whether to fall back to a local password mechanism if Kerberos password authentication fails.
   *
   * Default: yes
   */
  readonly KerberosOrLocalPasswd?: boolean;
  /**
   * Whether to automatically destroy the user's ticket cache file on logout.
   *
   * Default: yes
   */
  readonly KerberosTicketCleanup?: boolean;
  /**
   * Whether to store acquired tickets in per-session credential caches under /tmp/ rather than
   * per-user caches.
   *
   * Default: no.
   */
  readonly KerberosUniqueCCache?: boolean;
  /**
   * Whether to look at .k5login file for user's aliases. Default: yes.
   */
  readonly KerberosUseKuserok?: boolean;
  /**
   * Permitted key exchange algorithms the server offers to clients, comma-separated. Prefix with
   * '+' to append, '-' to remove, or '^' to prepend to the default set.
   */
  readonly KexAlgorithms?: string | string[];
  /**
   * Time after which the server disconnects if the user has not successfully logged in. Uses time
   * format. Zero means no limit.
   *
   * Default: 120 seconds
   */
  readonly LoginGraceTime?: number | string;
  /**
   * Verbosity level for logging messages from sshd.
   *
   * Default: INFO
   */
  readonly LogLevel?:
    | 'QUIET'
    | 'FATAL'
    | 'ERROR'
    | 'INFO'
    | 'VERBOSE'
    | 'DEBUG'
    | 'DEBUG1'
    | 'DEBUG2'
    | 'DEBUG3';
  /**
   * One or more overrides to LogLevel, as pattern lists matching source file, function, and line
   * number to force detailed logging. Intended for debugging.
   *
   * Default: no overrides
   */
  readonly LogVerbose?: string | string[];
  /**
   * Available MAC (message authentication code) algorithms for data integrity, comma-separated.
   * Algorithms with "-etm" suffix calculate MAC after encryption (encrypt-then-mac) and are
   * recommended.
   *
   * Prefix with '+' to append, '-' to remove, or '^' to prepend to the default set.
   */
  readonly MACs?: string | string[];
  /**
   * Maximum authentication attempts permitted per connection. Additional failures are logged once
   * half this value is reached.
   *
   * Default: 6
   */
  readonly MaxAuthTries?: number;
  /**
   * Maximum number of open shell, login, or subsystem sessions per network connection. Zero
   * prevents all sessions while still permitting forwarding.
   *
   * Default: 10
   */
  readonly MaxSessions?: number;
  /**
   * Maximum concurrent unauthenticated connections. A single integer, or "start:rate:full"
   * colon-separated triple for random early drop.
   *
   * Default: 10:30:100.
   */
  readonly MaxStartups?: number | string;
  /**
   * Path to the moduli file containing Diffie-Hellman groups for group-exchange key exchange
   * methods.
   *
   * Default: /etc/ssh/moduli
   */
  readonly ModuliFile?: string;
  /**
   * Service name used for PAM authentication, authorisation, and session controls when UsePAM is
   * enabled.
   *
   * Default: sshd
   */
  readonly PAMServiceName?: string;
  /**
   * Whether password authentication is allowed.
   *
   * Default: yes
   */
  readonly PasswordAuthentication?: boolean;
  /**
   * Whether the server allows login to accounts with empty password strings, when password
   * authentication is allowed.
   *
   * Default: no
   */
  readonly PermitEmptyPasswords?: boolean;
  /**
   * Addresses/ports on which a remote TCP port forwarding may listen, as "port" or "host:port"
   * specs. Set to "any" to remove restrictions, "none" to prohibit all.
   *
   * Default: all permitted
   */
  readonly PermitListen?: string | string[];
  /**
   * Destinations to which TCP port forwarding is permitted, as "host:port" specs. Set to "any" to
   * remove restrictions, "none" to prohibit all.
   *
   * Default: all permitted
   */
  readonly PermitOpen?: string | string[];
  /**
   * Whether root can log in. "prohibit-password" disables password and keyboard-interactive auth
   * for root. "forced-commands-only" allows root login with public key only when a command option
   * is specified.
   *
   * Default: prohibit-password
   */
  readonly PermitRootLogin?: boolean | 'prohibit-password' | 'forced-commands-only';
  /**
   * Whether pty allocation is permitted.
   *
   * Default: yes
   */
  readonly PermitTTY?: boolean;
  /**
   * Whether tun device forwarding is allowed. "point-to-point" permits layer 3, "ethernet" permits
   * layer 2. Specifying yes permits both.
   *
   * Default: no
   */
  readonly PermitTunnel?: boolean | 'point-to-point' | 'ethernet';
  /**
   * Whether ~/.ssh/environment and environment= options in ~/.ssh/authorized_keys are processed.
   * Accepts yes, no, or a comma-separated pattern list of environment variable names.
   *
   * Default: no.
   */
  readonly PermitUserEnvironment?: boolean | string;
  /**
   * Whether ~/.ssh/rc is executed. Default: yes.
   */
  readonly PermitUserRC?: boolean;
  /**
   * Maximum number of unauthenticated connections per source address. An integer or "none" for no
   * limit.
   *
   * Default: no limit
   */
  readonly PerSourceMaxStartups?: number | 'none';
  /**
   * Size of the CIDR address block used to group connections from the same source, as "IPv4:IPv6"
   * bit counts.
   *
   * Default: 32:128
   */
  readonly PerSourceNetBlockSize?: string;
  /**
   * Penalties applied per source address, as "keyword:duration" pairs. Set to "no" to disable.
   *
   * Default: no penalties
   */
  readonly PerSourcePenalties?: string | string[];
  /**
   * Addresses exempt from per-source penalties, as comma-separated addresses with wildcards and
   * CIDR notation.
   */
  readonly PerSourcePenaltyExemptList?: string | string[];
  /**
   * File in which to store the process ID of the SSH daemon. Set to "none" to disable.
   *
   * Default: /var/run/sshd.pid
   */
  readonly PidFile?: string;

  /**
   * Whether to print the date and time of last login.
   *
   * Default: yes
   */
  readonly PrintLastLog?: boolean;
  /**
   * Whether to print /etc/motd after a successful login.
   *
   * Default: yes
   */
  readonly PrintMotd?: boolean;
  /**
   * Signature algorithms accepted for public key authentication, comma-separated. Prefix with '+'
   * to append, '-' to remove, or '^' to prepend to the default set.
   */
  readonly PubkeyAcceptedAlgorithms?: string | string[];
  /**
   * Options for public key authentication. "touch-required" requires the key to attest a touch,
   * "verify-required" requires user verification. Multiple options may be combined with comma
   * separation.
   *
   * Default: none
   */
  readonly PubkeyAuthOptions?: string;
  /**
   * Whether public key authentication is allowed.
   *
   * Default: yes.
   */
  readonly PubkeyAuthentication?: boolean;
  /**
   * When present, unconditionally terminates the connection. Useful in Match blocks to block
   * specific hosts or users.
   */
  readonly RefuseConnection?: boolean;
  /**
   * Maximum amount of data that may be transmitted before the session key is renegotiated, with
   * optional time interval. Accepts bytes (with K/M/G suffix) and time format, or "default".
   *
   * Default: default
   */
  readonly RekeyLimit?: number | string;
  /**
   * Minimum RSA key size in bits that will be accepted.
   *
   * Default: no minimum
   */
  readonly RequiredRSASize?: number;
  /**
   * File containing revoked public keys. Set to "none" to not use a revoked keys file.
   *
   * Default: no revoked keys file
   */
  readonly RevokedKeys?: string;
  /**
   * Routing domain the connection is received on. Set to "%D" to use the routing domain of the
   * incoming connection.
   */
  readonly RDomain?: string;
  /**
   * Library path used to override the default internal security key (FIDO) support.
   */
  readonly SecurityKeyProvider?: string;
  /**
   * Environment variables to set in the child session, as "NAME=VALUE" pairs. Multiple directives
   * append.
   */
  readonly SetEnv?: string | string[];
  /**
   * Path to the sshd-auth binary. Default: auto-detected at compile time.
   */
  readonly SshdAuthPath?: string;
  /**
   * Path to the sshd-session binary. Default: auto-detected at compile time.
   */
  readonly SshdSessionPath?: string;
  /**
   * Octal file mode mask used when creating Unix-domain socket files for stream local forwarding.
   *
   * Default: 0177
   */
  readonly StreamLocalBindMask?: string;
  /**
   * Whether to remove an existing Unix-domain socket file for stream local forwarding before
   * creating a new one.
   *
   * Default: no
   */
  readonly StreamLocalBindUnlink?: boolean;
  /**
   * Whether to check file modes and ownership of the user's files and home directory before
   * accepting login.
   *
   * Default: yes
   */
  readonly StrictModes?: boolean;

  /**
   * Facility code used when logging messages from sshd.
   *
   * Default: AUTH
   */
  readonly SyslogFacility?:
    | 'DAEMON'
    | 'USER'
    | 'AUTH'
    | 'AUTHPRIV'
    | 'LOCAL0'
    | 'LOCAL1'
    | 'LOCAL2'
    | 'LOCAL3'
    | 'LOCAL4'
    | 'LOCAL5'
    | 'LOCAL6'
    | 'LOCAL7';
  /**
   * Whether the system should send TCP keepalive messages to the other side.
   *
   * Default: yes
   */
  readonly TCPKeepAlive?: boolean;
  /**
   * File listing certificate authorities trusted for user authentication. Set to "none" to not use.
   *
   * Default: no trusted CAs.
   */
  readonly TrustedUserCAKeys?: string;
  /**
   * Time after which an unused (no active channels) connection is closed. Uses time format.
   *
   * Default: none
   */
  readonly UnusedConnectionTimeout?: number | string;
  /**
   * Whether to use DNS for hostname lookups. When no, hostnames in `~/.ssh/authorized_keys` and
   * Match blocks will not be resolved.
   *
   * Default: yes
   */
  readonly UseDNS?: boolean;
  /**
   * Whether to use Pluggable Authentication Modules for authentication. Must be enabled for
   * PAMServiceName to have effect.
   *
   * Default: yes on most systems
   */
  readonly UsePAM?: boolean;
  /**
   * Text appended to the SSH protocol version banner. Set to "none" to omit.
   *
   * Default: the operating system description
   */
  readonly VersionAddendum?: string;
  /**
   * The first display number available for X11 forwarding.
   *
   * Default: 10
   */
  readonly X11DisplayOffset?: number;
  /**
   * Whether X11 forwarding is permitted.
   *
   * Default: no
   */
  readonly X11Forwarding?: boolean;
  /**
   * Maximum number of X11 displays available for X11 forwarding.
   *
   * Default: 1
   */
  readonly X11MaxDisplays?: number;
  /**
   * Whether sshd should bind the X11 forwarding server to the loopback address.
   *
   * Default: yes
   */
  readonly X11UseLocalhost?: boolean;
  /**
   * Path to the xauth(1) program. Set to "none" to disable X11 forwarding.
   *
   * Default: auto-detected at compile time
   */
  readonly XAuthLocation?: string;
}

/**
 * Serializes sshd_config.
 */
export function serializeSshConf(config: SshdConf): string {
  let s = '';

  if (config.port !== void 0) {
    if (Array.isArray(config.port)) {
      for (const p of config.port) {
        s += `Port ${p}\n`;
      }
    } else {
      s += `Port ${config.port}\n`;
    }
  }

  if (config.listenAddress !== void 0) {
    if (Array.isArray(config.listenAddress)) {
      for (const p of config.listenAddress) {
        s += `ListenAddress ${p}\n`;
      }
    } else {
      s += `ListenAddress ${config.listenAddress}\n`;
    }
  }

  if (config.options !== void 0) {
    for (const [key, value] of Object.entries(config.options)) {
      if (Array.isArray(value)) {
        s += `${key} ${value.map(_serializeValue).join(' ')}\n`;
      } else {
        s += `${key} ${_serializeValue(value)}\n`;
      }
    }
  }

  if (config.subsystem !== void 0) {
    for (const [name, cmd] of Object.entries(config.subsystem)) {
      s += `Subsystem ${_serializeValue(name)} ${cmd.map(_serializeValue).join(' ')}\n`;
    }
  }

  if (config.match !== void 0) {
    for (const [rule, settings] of Object.entries(config.match)) {
      s += `\nMatch ${_serializeValue(rule)}\n`;
      for (const [key, value] of Object.entries(settings)) {
        if (Array.isArray(value)) {
          s += `  ${key} ${value.map(_serializeValue).join(' ')}\n`;
        } else {
          s += `  ${key} ${_serializeValue(value)}\n`;
        }
      }
    }
  }

  return s;
}

function _serializeValue(value: boolean | number | string): string {
  return typeof value === 'boolean'
    ? value
      ? 'yes'
      : 'no'
    : typeof value === 'string'
      ? value.includes(' ')
        ? `"${value}"`
        : value
      : String(value);
}
