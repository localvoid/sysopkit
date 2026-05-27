---
title: resolved
description: systemd-resolved configuration types.
---

Type definitions for `resolved.conf` — the systemd-resolved DNS configuration file, and per-link resolved configuration.

```ts
import type { ResolvedConf, ResolvedLinkConf } from '@sysopkit/linux/systemd/resolved';
```

## ResolvedConf

```ts
type ResolvedConf = {
  Resolve: {
    DNS?: string;
    FallbackDNS?: string;
    Domains?: string;
    LLMNR?: 'yes' | 'no' | 'resolve';
    MulticastDNS?: 'yes' | 'no' | 'resolve';
    DNSOverTLS?: 'yes' | 'no' | 'opportunistic';
    DNSSEC?: 'yes' | 'no' | 'allow-downgrade';
    Cache?: 'yes' | 'no' | 'no-negative';
    CacheFromLocalhost?: 'yes' | 'no';
    DNSStubListener?: 'yes' | 'no' | 'udp' | 'tcp';
    DNSStubListenerExtra?: string;
    ReadEtcHosts?: 'yes' | 'no';
    ResolveUnicastSingleLabel?: 'yes' | 'no';
    staleRetentionSec?: string;
  };
};
```

## ResolvedLinkConf

Per-interface DNS settings:

```ts
type ResolvedLinkConf = {
  Resolve: {
    DNS?: string;
    Domains?: string;
    LLMNR?: 'yes' | 'no' | 'resolve';
    MulticastDNS?: 'yes' | 'no' | 'resolve';
    DNSOverTLS?: 'yes' | 'no' | 'opportunistic';
    DNSSEC?: 'yes' | 'no' | 'allow-downgrade';
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `DNS` | Space-separated list of DNS server addresses. Supports port, interface, and SNI. |
| `FallbackDNS` | Fallback DNS servers when no other DNS info is available. |
| `DNSSEC` | DNSSEC validation: `"yes"`, `"no"`, or `"allow-downgrade"`. |
| `DNSOverTLS` | DNS-over-TLS mode: `"yes"`, `"no"`, or `"opportunistic"`. |
| `DNSStubListener` | Stub resolver listener mode. Set to `"no"` when using local DNS forwarder. |
| `Cache` | DNS caching behavior. `"no-negative"` caches only positive answers. |
| `LLMNR` / `MulticastDNS` | Link-local name resolution protocols. |
