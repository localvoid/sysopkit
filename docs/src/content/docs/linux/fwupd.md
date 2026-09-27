---
title: fwupd
description: fwupd daemon configuration types.
---

Type definitions for `fwupd.conf` — the fwupd firmware update daemon configuration file (`fwupd.conf(5)`). All options live in the `[fwupd]` section. Serialize with `serializeIni` from `sysopkit/op/ini`, write to `/etc/fwupd/fwupd.conf`, then restart `fwupd`.

```ts
import type { FwupdConf } from '@sysopkit/linux/fwupd';
import { serializeIni } from 'sysopkit/op/ini';
import { createFile } from 'sysopkit/op/file';
import { FWUPD_CONF_PATH } from '@sysopkit/linux/fwupd';

await createFile({
  path: FWUPD_CONF_PATH,
  content: serializeIni({ fwupd: { UpdateMotd: 'false' } } satisfies FwupdConf),
});
```

## FwupdConf

```ts
type FwupdConf = {
  fwupd: {
    DisabledDevices?: string;
    DisabledPlugins?: string;
    ArchiveSizeMax?: number;
    IdleTimeout?: number;
    IdleInhibitStartupThreshold?: number;
    VerboseDomains?: string;
    UpdateMotd?: 'true' | 'false';
    EnumerateAllDevices?: 'true' | 'false';
    ApprovedFirmware?: string;
    UriSchemes?: string;
    IgnorePower?: 'true' | 'false';
    IgnoreRequirements?: 'true' | 'false';
    IgnoreEfivarsFreeSpace?: 'true' | 'false';
    OnlyTrustPostQuantumSignatures?: 'true' | 'false';
    OnlyTrusted?: 'true' | 'false';
    ShowDevicePrivate?: 'true' | 'false';
    TrustedUids?: string;
    HostBkc?: string;
    ReleaseDedupe?: 'true' | 'false';
    ReleasePriority?: 'local' | 'remote';
    EspLocation?: string;
    RequireImmutableEnumeration?: 'true' | 'false';
    Manufacturer?: string;
    ProductName?: string;
    ProductSku?: string;
    Family?: string;
    EnclosureKind?: string;
    BaseboardProduct?: string;
    BaseboardManufacturer?: string;
    TrustedReports?: string;
    P2pPolicy?: 'nothing' | 'metadata' | 'firmware' | 'metadata,firmware';
    TestDevices?: 'true' | 'false';
  };
};
```

### Key Options

| Option | Description |
| --- | --- |
| `DisabledDevices` | Semicolon-delimited GUIDs of devices to block. |
| `DisabledPlugins` | Plugin names to block (see `fwupdmgr get-plugins`). |
| `ArchiveSizeMax` | Maximum loadable archive size in Mb (default: 25% of RAM). |
| `IdleTimeout` / `IdleInhibitStartupThreshold` | Daemon idle shutdown timeout in seconds (default: 300, `0` = never) and startup inhibit threshold in ms (default: 500). |
| `UpdateMotd` | Update the message of the day on device/metadata changes (default: `"true"`). |
| `UriSchemes` | Allowed URI schemes in preference order (default: `"file;https;http;ipfs"`). |
| `OnlyTrusted` | Only install firmware signed with a trusted key — never disable on production systems (default: `"true"`). |
| `HostBkc` | Comma-separated best-known-configuration IDs for `fwupdmgr sync` (e.g. `"vendor-factory-2021q1,mycompany-2023"`). |
| `ReleasePriority` | Prefer `"local"` or `"remote"` when the same release exists in multiple sources (omit = no adjustment). |
| `TrustedReports` | `;`-OR / `&`-AND expressions marking releases as trusted-report (default: `"VendorId=$OEM"`). |
| `P2pPolicy` | Peer-to-peer policy: `"nothing"`, `"metadata"`, `"firmware"`, or `"metadata,firmware"` (default: `"metadata"`). |
