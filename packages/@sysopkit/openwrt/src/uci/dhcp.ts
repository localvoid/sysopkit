export type UciDhcp = UciDhcpSection[];

export type UciDhcpSection =
  | UciDhcpDnsmasq
  | UciDhcpDhcp
  | UciDhcpOdhcp
  | UciDhcpHost
  | UciDhcpMatch
  | UciDhcpBoot;

export type UciDhcpDnsmasq = {
  readonly type: 'dnsmasq';
  readonly name?: string;
  readonly options: {
    readonly domainneeded?: '0' | '1';
    readonly localise_queries?: '0' | '1';
    readonly rebind_protection?: '0' | '1';
    readonly rebind_localhost?: '0' | '1';
    readonly local?: string;
    readonly domain?: string;
    readonly expandhosts?: '0' | '1';
    readonly cachesize?: string | number;
    readonly authoritative?: '0' | '1';
    readonly readethers?: '0' | '1';
    readonly leasefile?: string;
    readonly resolvfile?: string;
    readonly localservice?: '0' | '1';
    readonly ednspacket_max?: string | number;
    readonly enable_tftp?: '0' | '1';
    readonly tftp_root?: string;
  };
};

export type UciDhcpDhcp = {
  readonly type: 'dhcp';
  readonly name?: string;
  readonly options: {
    readonly interface?: string;
    readonly start?: string | number;
    readonly limit?: string | number;
    readonly leasetime?: string;
    readonly dhcpv4?: string;
  };
};

export type UciDhcpOdhcp = {
  readonly type: 'odhcp';
  readonly name?: string;
  readonly options: {
    readonly maindhcp?: '0' | '1';
    readonly leasefile?: string;
    readonly leasetrigger?: string;
    readonly loglevel?: number;
  };
};

export type UciDhcpHost = {
  readonly type: 'host';
  readonly name?: string;

  readonly options: {
    readonly ip?: string;
  };
  readonly lists: {
    readonly mac?: string[];
  };
};

export type UciDhcpMatch = {
  readonly type: 'match';
  readonly name?: string;

  readonly options: {
    readonly networkid?: string;
    readonly match?: string;
  };
};

export type UciDhcpBoot = {
  readonly type: 'boot';
  readonly name?: string;

  readonly options: {
    readonly filename?: string;
  };
};
