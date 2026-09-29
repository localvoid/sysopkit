---
title: zram-generator
description: zram-generator swap device configuration types.
---

Type definitions for `zram-generator.conf` — the zram-generator swap device configuration file.

```ts
import type { ZramGeneratorConf } from '@sysopkit/linux/systemd';
```

## ZramGeneratorConf

Each device is configured independently in its `[zramN]` section (`N` is a nonnegative integer). Devices with the final size of `0` are discarded. The global section may contain `set!` directives defining extra variables for size expressions; other sections are ignored.

```ts
type ZramGeneratorConf = Record<`zram${number}`, ZramGeneratorDeviceConf> &
  Record<`set!${string}`, string>;

type ZramGeneratorDeviceConf = {
  'host-memory-limit'?: number | 'none';
  'zram-size'?: number | string;
  'zram-resident-limit'?: number | string;
  'compression-algorithm'?: string;
  'writeback-device'?: string;
  'swap-priority'?: number;
  'mount-point'?: string;
  'fs-type'?: string;
  'options'?: string;
};
```

### Key Options

| Option | Description |
| --- | --- |
| `zram-size` | Device size as a function of MemTotal (`ram` variable, default `"min(ram / 2, 4096)"`). Supports arithmetic, SI suffixes, `min`/`max`, and trig functions. |
| `zram-resident-limit` | Maximum resident memory limit (same expression format, `0` for no limit). |
| `host-memory-limit` | Skip device creation above this usable RAM limit (MB), or `"none"`. |
| `compression-algorithm` | Whitespace-separated algorithms with optional `(params)`; later entries become recompression algorithms. |
| `writeback-device` | Block device for incompressible pages under memory pressure. |
| `swap-priority` | Relative swap priority (-1..32767, default `100`). |
| `mount-point` / `fs-type` / `options` | Format as filesystem instead of swap (`fs-type` defaults to `"ext2"` with a mount-point, else `"swap"`; `options` defaults to `"discard"`). |
