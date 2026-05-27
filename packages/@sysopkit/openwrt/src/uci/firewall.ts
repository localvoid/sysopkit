export type UciFirewall = UciFirewallSection[];

export type UciFirewallSection = UciFirewallDefault | UciFirewallZone | UciFirewallForwarding;

export type UciFirewallDefault = {
  type: 'default';
  name?: string;

  options: {
    input?: string;
    output?: string;
    forward?: string;
    synflood_protect?: '0' | '1';
  };
};

export type UciFirewallZone = {
  type: 'zone';
  name?: string;

  options: {
    name?: string;
    input?: string;
    output?: string;
    forward?: string;
    masq?: '0' | '1';
    mtu_fix?: '0' | '1';
  };
  lists?: {
    network?: string[];
  };
};

export type UciFirewallRule = {
  type: 'rule';
  name?: string;

  options: {
    name?: string;
    src?: string;
    src_port?: string;
    dest?: string;
    dest_port?: string;
    proto?: string;
    icmp_type?: string;
    limit?: string;
    family?: string;
    target?: string;
  };
  lists?: {
    proto?: string[];
    icmp_type?: string[];
  };
};

export type UciFirewallForwarding = {
  type: 'forwarding';
  name?: string;

  options: {
    src?: string;
    dest?: string;
  };
};
