/**
 * @module systemd/zram-generator
 *
 * zram-generator configuration management.
 *
 * @see zram-generator.conf(5) - Systemd unit generator for zram swap devices (configuration)
 *
 * Configuration is written to a drop-in file at:
 * /etc/systemd/zram-generator.conf.d/sysops.conf
 *
 * Each device is configured independently in its `[zramN]` section, where N is
 * a nonnegative integer. Devices with the final size of 0 are discarded.
 * The global section (before any section header) may contain `set!` directives
 * that define extra variables for `zram-size`/`zram-resident-limit` expressions.
 * Other sections are ignored.
 */

export const ZRAM_GENERATOR_CONF_PATH = '/etc/systemd/zram-generator.conf';
export const ZRAM_GENERATOR_DROP_IN_PATH = '/etc/systemd/zram-generator.conf.d';

/**
 * Options for a single zram device (`[zramN]` section of zram-generator.conf).
 *
 * See zram-generator.conf(5) for detailed descriptions of each option.
 */
export type ZramGeneratorDeviceConf = {
  /**
   * Upper limit on the total usable RAM (MemTotal in /proc/meminfo) in megabytes
   * above which the device will not be created.
   * Use "none" to override a limit set earlier.
   * Default: "none".
   */
  'host-memory-limit'?: number | 'none';

  /**
   * Size of the zram device as a function of MemTotal, available as the `ram`
   * variable. Additional variables may be provided by `set!` directives.
   * Supports arithmetic operators (^%/*-+), e, π, SI suffixes, log(), int(),
   * ceil(), floor(), round(), abs(), min(), max(), and trigonometric functions.
   * Default: "min(ram / 2, 4096)".
   */
  'zram-size'?: number | string;

  /**
   * Maximum resident memory limit of the zram device (or 0 for no limit)
   * as a function of MemTotal, available as the `ram` variable.
   * Same format as `zram-size`. Default: 0.
   */
  'zram-resident-limit'?: number | string;

  /**
   * Compression algorithm(s) for the zram device.
   * Takes a whitespace-separated list, with optional per-algorithm parameters
   * in parentheses (e.g., "zstd (level=3)"). When multiple algorithms are given
   * and recompression is enabled in the kernel, subsequent ones become
   * recompression algorithms with decreasing priority. A parenthesised parameter
   * list without an algorithm sets the global recompression parameters.
   * If unset, the kernel's default is used.
   */
  'compression-algorithm'?: string;

  /**
   * Block device to write incompressible pages to under memory pressure
   * (corresponds to /sys/block/zramX/backing_dev).
   * Example: "/dev/disk/by-partuuid/2d54ffa0-01".
   * If unset, incompressible pages are kept in RAM.
   */
  'writeback-device'?: string;

  /**
   * Relative swap priority, a value between -1 and 32767.
   * Higher numbers indicate higher priority.
   * Default: 100.
   */
  'swap-priority'?: number;

  /**
   * Format the device with a file system (not as swap) and mount it over the
   * specified directory. When neither this option nor `fs-type` is specified,
   * the device is formatted as swap.
   * Note: the device is temporary, contents are destroyed on unmount.
   */
  'mount-point'?: string;

  /**
   * How the device shall be formatted. Default is "ext2" if `mount-point` is
   * specified, and "swap" otherwise.
   * Note: the device is temporary, contents are destroyed on unmount.
   * @see systemd-makefs(8)
   */
  'fs-type'?: string;

  /**
   * Mount or swapon options. Availability depends on `fs-type`.
   * Default: "discard".
   */
  options?: string;
};

/**
 * Options for configuring zram-generator.
 *
 * Keys are `[zramN]` device sections (N is a nonnegative integer) holding
 * {@link ZramGeneratorDeviceConf} options, plus optional global `set!`
 * directives (`set!variable=program`: program is executed by the shell, its
 * stdout parsed as an arithmetic expression, then remembered into `variable`
 * for use in later `set!`s and `zram-size`/`zram-resident-limit` expressions).
 * See zram-generator.conf(5) for details.
 *
 * Example:
 * ```
 * const conf: ZramGeneratorConf = {
 *   zram0: { 'zram-size': 'ram / 2' },
 * };
 * ```
 */
export type ZramGeneratorConf = Record<`zram${number}`, ZramGeneratorDeviceConf> &
  Record<`set!${string}`, string>;
