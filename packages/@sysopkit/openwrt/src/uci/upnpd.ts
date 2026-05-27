export type UciUpnpd = UciUpnpdSection[];

export type UciUpnpdSection = UciUpnpdConfig | UciUpnpdPermRule;

export type UciUpnpdConfig = {
  type: 'upnpd';
  name?: string;

  options: {
    /** Enable UPnP/IGD/NAT-PMP. */
    enabled?: '0' | '1';
    /** Enable NAT-PMP support. */
    enable_natpmp?: '0' | '1';
    /** Enable UPnP IGD support. */
    enable_upnp?: '0' | '1';
    /** Secure mode: only allow bindings to same IP as requesting client. */
    secure_mode?: '0' | '1';
    /** Write log to stdout/file instead of syslog. */
    log_output?: '0' | '1';
    /** Max download speed in kbit/s (0 = unlimited). */
    download?: string | number;
    /** Max upload speed in kbit/s (0 = unlimited). */
    upload?: string | number;
    /** External/WAN interface name. */
    external_iface?: string;
    /** Internal/LAN interface name. */
    internal_iface?: string;
    /** Listening port for UPnP. */
    port?: string | number;
    /** Path to UPnP lease file. */
    upnp_lease_file?: string;
    /** Path to UPnPv6 lease file. */
    upnp_lease_file6?: string;
    /** Enable IGDv1 support. */
    igdv1?: '0' | '1';
    /** Enable IGDv2 support. */
    igdv2?: '0' | '1';
    /** STUN host for discovering external IP. */
    stun_host?: string;
    /** STUN port. */
    stun_port?: string | number;
    /** Presentation URL for router web interface. */
    presentation_url?: string;
    /** Notify interval in seconds. */
    notify_interval?: string | number;
    /** MiniUPnPd config file path. */
    miniupnpd_conf?: string;
    /** Downrise script. */
    downrise_script?: string;
    /** Uplift script. */
    uplift_script?: string;
    /** Packet filter. */
    packet_filter?: string;
    /** Boot ID offset. */
    bootid_upnp_delay?: string | number;
  };
};

export type UciUpnpdPermRule = {
  type: 'perm_rule';
  name?: string;

  options: {
    /** Action: allow or deny. */
    action?: 'allow' | 'deny';
    /** External port range (e.g. 1024-65535). */
    ext_ports?: string;
    /** Internal address/CIDR (e.g. 192.168.1.0/24). */
    int_addr?: string;
    /** Internal port range. */
    int_ports?: string;
    /** Rule description. */
    comment?: string;
  };
};
