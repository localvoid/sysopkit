export type UciDropbear = UciDropbearSection[];

export type UciDropbearSection = UciDropbear;

export type UciDropbearDropbear = {
  type: 'dropbear';
  name?: string;

  options: {
    /** Enable password authentication. */
    PasswordAuth?: 'on' | 'off';
    /** Allow root login with password. */
    RootPasswordAuth?: 'on' | 'off';
    /** Allow root login at all. */
    RootLogin?: 'on' | 'off';
    /** Listening port (can specify multiple). */
    Port?: string | number;
    /** Path to SSH banner file. */
    BannerFile?: string;
    /** Bind to specific network interface. */
    Interface?: string;
    /** Bind directly to interface (bypasses alias resolution). */
    DirectInterface?: string;
    /** Enable gateway ports for remote port forwarding. */
    GatewayPorts?: 'on' | 'off';
    /** Idle timeout in seconds (0 = disabled). */
    Idletimeout?: string | number;
    /** Maximum authentication attempts per connection. */
    MaxAuthTries?: string | number;
    /** Enable SSH keepalive messages. */
    SSHKeepAlive?: 'on' | 'off';
    /** Allow TCP forwarding. */
    AllowTcpForwarding?: 'on' | 'off';
    /** Enable compression. */
    Compression?: 'on' | 'off';
    /** Path to authorized keys file. */
    AuthorizeFile?: string;
    /** Path to host key files. */
    HostKeys?: string;
    /** Reverse DNS lookup timeout in seconds. */
    ReceiveWindow?: string | number;
  };
  lists?: {
    /** Listening ports (multiple). */
    Port?: string[];
    /** Host key file paths. */
    HostKeys?: string[];
    /** Allowed remote hosts. */
    AllowRemoteHosts?: string[];
    /** Denied remote hosts. */
    DenyRemoteHosts?: string[];
  };
};
