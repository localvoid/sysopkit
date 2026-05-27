export type UciSystem = UciSystemSection[];

export type UciSystemSection =
  | UciSystemSystem
  | UciSystemTimeserver
  | UciSystemLed
  | UciSystemRDNSSD;

export type UciSystemSystem = {
  type: 'system';
  name?: string;

  options: {
    /** Hostname of the device. */
    hostname?: string;
    /** System timezone (e.g. UTC, EST5EDT). */
    timezone?: string;
    /** Path to timezone file in /usr/share/zoneinfo. */
    zonename?: string;
    /** TTY login prompt. */
    ttylogin?: '0' | '1';
    /** Keep last logged in file. */
    log_size?: string | number;
    /** Log output file. */
    log_file?: string;
    /** Cron log file. */
    cronloglevel?: string;
    /** Password for root user (hashed). */
    root_password?: string;
    /** Description of the device. */
    description?: string;
    /** Device model. */
    model?: string;
    /** Board name. */
    boardname?: string;
  };
  lists?: {
    /** DNS search domains. */
    dns_search?: string[];
  };
};

export type UciSystemTimeserver = {
  type: 'timeserver';
  name?: string;

  options: {
    /** Enable NTP client. */
    enable_server?: '0' | '1';
  };
  lists?: {
    /** NTP server hostnames. */
    server?: string[];
  };
};

export type UciSystemLed = {
  type: 'led';
  name?: string;

  options: {
    /** Sysfs LED name. */
    sysfs?: string;
    /** LED trigger: timer, heartbeat, netdev, usbport, etc. */
    trigger?: string;
    /** Default state: 0=off, 1=on. */
    default?: '0' | '1';
    /** Delay on (ms) for timer trigger. */
    delayon?: string | number;
    /** Delay off (ms) for timer trigger. */
    delayoff?: string | number;
    /** Network device for netdev trigger. */
    dev?: string;
    /** Mode for netdev: link, tx, rx. */
    mode?: string;
    /** USB port for usbport trigger. */
    port?: string;
    /** Invert LED behavior. */
    inverted?: '0' | '1';
  };
};

export type UciSystemRDNSSD = {
  type: 'rdnssd';
  name?: string;

  options: {
    /** Enable RDNSSD. */
    enabled?: '0' | '1';
  };
};
