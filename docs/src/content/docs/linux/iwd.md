---
title: iwd
description: iwd wireless daemon configuration types.
---

Type definitions for `main.conf` — the iwd system-wide configuration file (`iwd.config(5)`), and for known-network files — `.psk` (plus the shared groups of `.open` / `.8021x`, `iwd.network(5)`). Serialize with `serializeIni` from `sysopkit/op/ini`, write `main.conf` to `/etc/iwd/main.conf` and network files to `/var/lib/iwd/`, then restart `iwd`.

```ts
import type { IwdMainConf, IwdPskConf } from '@sysopkit/linux/iwd';
import { IWD_MAIN_CONF_PATH, IWD_NETWORK_DIR, getIwdNetworkPath } from '@sysopkit/linux/iwd';
import { createFile } from 'sysopkit/op/file';
import { serializeIni } from 'sysopkit/op/ini';

await createFile({
  path: IWD_MAIN_CONF_PATH,
  content: serializeIni({
    General: { EnableNetworkConfiguration: 'true' },
    Network: { NameResolvingService: 'systemd' },
  } satisfies IwdMainConf),
});

await createFile({
  path: getIwdNetworkPath('Coffee Shop', 'psk'),
  content: serializeIni({
    Settings: { AutoConnect: 'true' },
    Security: { Passphrase: 'secret123' },
  } satisfies IwdPskConf),
});
```

## IwdMainConf

```ts
type IwdMainConf = {
  General?: {
    EnableNetworkConfiguration?: 'true' | 'false';
    UseDefaultInterface?: 'true' | 'false'; // deprecated, use DriverQuirks.DefaultInterface
    AddressRandomization?: 'disabled' | 'once' | 'network';
    AddressRandomizationRange?: 'full' | 'nic';
    RoamThreshold?: number;
    RoamThreshold5G?: number;
    CriticalRoamThreshold?: number;
    CriticalRoamThreshold5G?: number;
    RoamRetryInterval?: number;
    ManagementFrameProtection?: 0 | 1 | 2;
    ControlPortOverNL80211?: 'true' | 'false';
    DisableANQP?: 'true' | 'false';
    DisableOCV?: 'true' | 'false';
    SystemdEncrypt?: string;
    Country?: string;
    DisablePMKSA?: 'true' | 'false';
  };
  Network?: {
    EnableIPv6?: 'true' | 'false';
    NameResolvingService?: 'resolvconf' | 'systemd' | 'none';
    RoutePriorityOffset?: number;
  };
  Blacklist?: {
    InitialTimeout?: number;
    InitialAccessPointBusyTimeout?: number;
    InitialRoamRequestedTimeout?: number; // deprecated
    Multiplier?: number;
    MaximumTimeout?: number;
  };
  Rank?: {
    BandModifier2_4GHz?: number;
    BandModifier5GHz?: number;
    BandModifier6GHz?: number;
    HighUtilizationThreshold?: number;
    HighStationCountThreshold?: number;
  };
  Scan?: {
    DisablePeriodicScan?: 'true' | 'false';
    InitialPeriodicScanInterval?: number;
    MaximumPeriodicScanInterval?: number;
    DisableRoamingScan?: 'true' | 'false';
  };
  IPv4?: {
    APAddressPool?: string;
  };
  DriverQuirks?: {
    DefaultInterface?: string;
    ForcePae?: string;
    PowerSaveDisable?: string;
    MulticastRxDisable?: string;
    SaeDisable?: string;
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `General.EnableNetworkConfiguration` | Let iwd assign IPs (static files or built-in DHCP) and serve DHCP in AP mode (default: disabled). |
| `General.AddressRandomization` | `"disabled"`, `"once"`, or `"network"` (per-SSID MAC, derived from SSID + address). |
| `General.AddressRandomizationRange` | `"nic"` randomizes the last 3 octets, `"full"` randomizes all 6. |
| `General.RoamThreshold` / `RoamThreshold5G` | Roam aggressiveness in dBm (defaults: `-70` / `-76`). |
| `General.ManagementFrameProtection` | `1` = enable when supported, `2` = always require (may break some hardware/networks). |
| `General.DisableANQP` | Set to `"false"` to use Hotspot 2.0 networks (needs kernel 5.3+). |
| `Network.NameResolvingService` | `"resolvconf"`, `"systemd"` (default), or `"none"`. |
| `Rank.BandModifier*GHz` | Band preference multiplier (default `1.0`); `0.0` disables the band entirely. |
| `IPv4.APAddressPool` | AP-mode subnet/DHCP space (default: `"192.168.0.0/16"`). |

## IwdPskConf

Covers `.psk` files; `[Settings]`, `[Network]`, `[IPv4]`, and `[IPv6]` are shared with `.open` / `.8021x`, and `[Security]` additionally holds the EAP settings for `.8021x`.

```ts
type IwdPskConf = {
  Settings?: {
    AutoConnect?: 'true' | 'false';
    Hidden?: 'true' | 'false';
    AlwaysRandomizeAddress?: 'true' | 'false';
    AddressOverride?: string;
    TransitionDisable?: 'true' | 'false';
    DisabledTransitionModes?: string;
    UseDefaultEccGroup?: 'true' | 'false';
  };
  Security?: {
    'Passphrase'?: string;
    'PasswordIdentifier'?: string;
    'PreSharedKey'?: string;
    'EAP-Method'?: IwdEapMethod | (string & {});
    'EAP-Identity'?: string;
    'EAP-Password'?: string;
    'EAP-Password-Hash'?: string;
    'EAP-TLS-CACert'?: string;
    'EAP-TTLS-CACert'?: string;
    'EAP-PEAP-CACert'?: string;
    'EAP-TLS-ClientCert'?: string;
    'EAP-TLS-ClientKey'?: string;
    'EAP-TLS-ClientKeyBundle'?: string;
    'EAP-TLS-ClientKeyPassphrase'?: string;
    'EAP-TLS-ServerDomainMask'?: string;
    'EAP-TTLS-ServerDomainMask'?: string;
    'EAP-PEAP-ServerDomainMask'?: string;
    'EAP-TLS-FastReauthentication'?: 'true' | 'false';
    'EAP-TTLS-FastReauthentication'?: 'true' | 'false';
    'EAP-PEAP-FastReauthentication'?: 'true' | 'false';
    'EAP-TTLS-Phase2-Method'?: string;
    'EAP-TTLS-Phase2-Identity'?: string;
    'EAP-TTLS-Phase2-Password'?: string;
    'EAP-PEAP-Phase2-Method'?: string;
    [key: `EAP-TTLS-Phase2-${string}`]: string | undefined;
    [key: `EAP-PEAP-Phase2-${string}`]: string | undefined;
    'EncryptedSalt'?: string;
    'EncryptedSecurity'?: string;
  };
  Network?: {
    MulticastDNS?: 'true' | 'false' | 'resolve';
  };
  IPv4?: {
    Address?: string;
    Gateway?: string;
    DNS?: string;
    Netmask?: string;
    Broadcast?: string;
    DomainName?: string;
    SendHostname?: 'true' | 'false';
  };
  IPv6?: {
    Enabled?: 'true' | 'false';
    Address?: string;
    Gateway?: string;
    DNS?: string;
    DomainName?: string;
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `Security.Passphrase` / `PreSharedKey` | 8–63 char passphrase, or 64-char hex key (one is required for PSK; otherwise the agent is asked). |
| `Security.EAP-Method` | `"AKA"`, `"AKA'"`, `"MSCHAPV2"`, `"PEAP"`, `"PWD"`, `"SIM"`, `"TLS"`, `"TTLS"` (`"GTC"`/`"MD5"` inner only). |
| `Security.EAP-TLS-CACert` et al. | CA bundle path or `embed:<name>` reference to an appended `[@pem@<name>]` group. |
| `Security.EAP-TTLS-Phase2-Method` | `Tunneled-CHAP/MSCHAP/MSCHAPv2/PAP` or an inner EAP method; inner keys use the `EAP-TTLS-Phase2-` / `EAP-PEAP-Phase2-` prefix. |
| `IPv4.Address` / `Gateway` | Static IPv4 config (both required when static; `Netmask` defaults to `255.255.255.0`). |
| `IPv6.Enabled` | Per-network override of the global `[Network].EnableIPv6` default. |

## Network file paths

`getIwdNetworkPath(ssid, security)` returns the `/var/lib/iwd/` path for an SSID, applying the `iwd.network(5)` naming rule (verbatim when the SSID is only alphanumerics/spaces/`_`/`-`, otherwise `=` + lowercase hex of the UTF-8 bytes) plus the `.open` / `.psk` / `.8021x` suffix. `encodeIwdSsid(ssid)` exposes just the encoding step.

Embedded PEMs (`[@pem@<name>]` groups) are raw multi-line payloads that `serializeIni` cannot emit — append them to the serialized output manually and reference them as `embed:<name>`.
