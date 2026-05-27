export type UciSqm = UciSqmQueue[];

export type UciSqmQueue = {
  type: 'queue';
  name?: string;

  options: {
    /** Enable this SQM instance. */
    enabled?: '0' | '1';
    /** Network interface name (e.g. eth0, wan). */
    interface?: string;
    /** Download rate in kbit/s. */
    download?: string | number;
    /** Upload rate in kbit/s. */
    upload?: string | number;
    /** Queueing discipline: fq_codel, cake, etc. */
    qdisc?: string;
    /** SQM script: simple.qos, piece_of_cake.qos, etc. */
    script?: string;
    /** Link layer type: none, ethernet, atm, pppoe. */
    linklayer?: string;
    linklayer_adaptation_mechanism?: string;
    /** Enable advanced qdisc settings. */
    qdisc_advanced?: '0' | '1';
    /** Ingress ECN mode: ECN, NOECN. */
    ingress_ecn?: 'ECN' | 'NOECN';
    /** Egress ECN mode: ECN, NOECN. */
    egress_ecn?: 'ECN' | 'NOECN';
    /** Enable really advanced qdisc settings. */
    qdisc_really_really_advanced?: '0' | '1';
    /** Ingress target bandwidth (auto or value). */
    itarget?: string;
    /** Egress target bandwidth (auto or value). */
    etarget?: string;
    /** Per-packet overhead in bytes (e.g. 44 for ADSL). */
    overhead?: string | number;
    /** Log verbosity level. */
    verbosity?: string | number;
    /** Enable debug logging. */
    debug_logging?: '0' | '1';

    tcMTU?: string | number;
    tcTSIZE?: string | number;
    tcMPU?: string | number;
  };
};
