/**
 * @module network
 *
 * Libvirt virtual network management with a normalized TypeScript API.
 *
 * Define networks with `NetworkConf` instead of hand-writing XML; `virsh`
 * remains the transport and `Bun.XML` (via the internal `./xml.js` helpers)
 * handles XML, so this module only runs on the Bun runtime.
 *
 * Networks with options outside the normalized model (static DHCP host
 * entries, DNS forwarders, portgroups, ...) can still be managed through the
 * raw XML path of `defineNetwork()` (`{ name, xml }`), which defines by
 * existence and only redefines with `update: true`.
 *
 * @see virsh(1) - management user interface for libvirt guests and hypervisor
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';
import { withTempFile } from 'sysopkit/op/temp';

import {
  _parseInfoBlock,
  _parseListTable,
  _tryVirshXml,
  _virsh,
  VIRSH_XML_TEMPLATE,
  type VirshOptions,
} from './common.js';
import {
  asArray,
  childElement,
  childText,
  isXmlElement,
  parseXmlDocument,
  stringifyXmlDocument,
  xmlAttr,
  type MutableXmlElement,
  type XmlDocument,
  type XmlValue,
} from './xml.js';

/** Forwarding modes modeled by `NetworkConf`. */
export type NetworkMode = 'nat' | 'isolated' | 'bridge';

/** A DHCP range served on a virtual network. */
export interface NetworkDhcpRange {
  readonly start: string;
  readonly end: string;
}

/**
 * Normalized virtual network configuration.
 *
 * Only the modeled subset participates in idempotency checks: fields left
 * undefined act as wildcards when comparing against `virsh net-dumpxml`
 * output (see `networkConfigMatches`).
 */
export interface NetworkConf {
  /** Network name. */
  readonly name: string;
  /** Forwarding mode. Default: `nat`. */
  readonly mode?: NetworkMode;
  /**
   * Bridge device name (`<bridge name="..."/>`). When omitted, libvirt
   * auto-assigns one (`virbrN`).
   */
  readonly bridge?: string;
  /**
   * Gateway address (`<ip address="..."/>`, e.g. `192.168.122.1`).
   * Required for `nat` networks.
   */
  readonly ip?: string;
  /** Netmask for the gateway address (e.g. `255.255.255.0`). */
  readonly netmask?: string;
  /** DHCP ranges served on the network. */
  readonly dhcpRanges?: readonly NetworkDhcpRange[];
}

/**
 * Serializes a normalized network configuration to libvirt network XML.
 */
export function serializeNetworkXml(network: NetworkConf): string {
  if (network.name === '') {
    throw new Error('network name must not be empty');
  }
  const mode = network.mode ?? 'nat';
  if (mode === 'nat' && network.ip === undefined) {
    throw new Error(`nat network '${network.name}' requires an ip address`);
  }

  const root: MutableXmlElement = { name: network.name };
  if (network.bridge !== undefined) {
    root['bridge'] = { '@name': network.bridge };
  }
  if (mode === 'nat') {
    root['forward'] = { '@mode': 'nat' };
  } else if (mode === 'bridge') {
    root['forward'] = { '@mode': 'bridge' };
  }
  if (network.ip !== undefined) {
    const ip: MutableXmlElement = { '@address': network.ip };
    if (network.netmask !== undefined) {
      ip['@netmask'] = network.netmask;
    }
    const ranges = network.dhcpRanges ?? [];
    if (ranges.length > 0) {
      ip['dhcp'] = {
        range: ranges.map((r) => ({ '@start': r.start, '@end': r.end })),
      };
    }
    root['ip'] = ip;
  }
  const doc: XmlDocument = { network: root };
  return stringifyXmlDocument(doc);
}

/**
 * Parses libvirt network XML (e.g. `virsh net-dumpxml` output) into the
 * normalized model, keeping only the modeled subset.
 *
 * Forward modes other than `nat`/`bridge` (e.g. `route`, `open`) parse as
 * `isolated`; manage those through the raw XML path of `defineNetwork()`.
 */
export function parseNetworkXml(xml: string): NetworkConf {
  const doc = parseXmlDocument(xml);
  const root = doc['network'];
  if (!isXmlElement(root)) {
    throw new Error('invalid network XML: missing <network> root');
  }
  const name = childText(root, 'name');
  if (name === undefined) {
    throw new Error('invalid network XML: missing <name>');
  }

  const forwardEl = childElement(root, 'forward');
  const forwardMode = isXmlElement(forwardEl) ? xmlAttr(forwardEl, 'mode') : undefined;
  const mode: NetworkMode =
    forwardMode === 'nat' ? 'nat' : forwardMode === 'bridge' ? 'bridge' : 'isolated';

  const bridgeEl = childElement(root, 'bridge');
  const bridge = isXmlElement(bridgeEl) ? xmlAttr(bridgeEl, 'name') : undefined;

  const ipEl = childElement(root, 'ip');
  const ip = isXmlElement(ipEl) ? xmlAttr(ipEl, 'address') : undefined;
  const netmask = isXmlElement(ipEl) ? xmlAttr(ipEl, 'netmask') : undefined;

  const dhcpEl = isXmlElement(ipEl) ? childElement(ipEl, 'dhcp') : undefined;
  const ranges: NetworkDhcpRange[] = asArray<XmlValue>(
    isXmlElement(dhcpEl) ? dhcpEl['range'] : undefined,
  ).flatMap((r) => {
    if (!isXmlElement(r)) {
      return [];
    }
    const start = xmlAttr(r, 'start');
    const end = xmlAttr(r, 'end');
    return start === undefined || end === undefined ? [] : [{ start, end }];
  });

  return {
    name,
    ...(mode === 'nat' ? {} : { mode }),
    ...(bridge === undefined ? {} : { bridge }),
    ...(ip === undefined ? {} : { ip }),
    ...(netmask === undefined ? {} : { netmask }),
    ...(ranges.length === 0 ? {} : { dhcpRanges: ranges }),
  };
}

/**
 * Compares live configuration against desired configuration.
 *
 * Fields left undefined in `desired` act as wildcards (libvirt-assigned
 * values such as auto-created bridge names never cause a mismatch).
 */
export function networkConfigMatches(current: NetworkConf, desired: NetworkConf): boolean {
  if (current.name !== desired.name) {
    return false;
  }
  if ((desired.mode ?? 'nat') !== (current.mode ?? 'nat')) {
    return false;
  }
  if (desired.bridge !== undefined && desired.bridge !== current.bridge) {
    return false;
  }
  if (desired.ip !== undefined && desired.ip !== current.ip) {
    return false;
  }
  if (desired.netmask !== undefined && desired.netmask !== current.netmask) {
    return false;
  }
  if (desired.dhcpRanges !== undefined) {
    const currentRanges = current.dhcpRanges ?? [];
    if (
      desired.dhcpRanges.length !== currentRanges.length ||
      desired.dhcpRanges.some(
        (r, i) => r.start !== currentRanges[i].start || r.end !== currentRanges[i].end,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Options for network operations that address a network by name. */
export interface NetworkOptions extends VirshOptions {
  readonly name: string;
}

/** A network entry from `virsh net-list --all`. */
export interface NetworkListEntry {
  readonly name: string;
  readonly active: boolean;
  readonly autostart: boolean;
  readonly persistent: boolean;
}

/** Parses `virsh net-list --all` table output. */
export function parseNetworkList(output: string): NetworkListEntry[] {
  return _parseListTable(output)
    .filter((cols) => cols.length >= 4)
    .map((cols) => ({
      name: cols[0],
      active: cols[1] === 'active',
      autostart: cols[2] === 'yes',
      persistent: cols[3] === 'yes',
    }));
}

/** Lists all networks (active and defined) via `virsh net-list --all`. */
export async function listNetworks(options?: VirshOptions): Promise<NetworkListEntry[]> {
  const { stdout } = await sh(_virsh(options?.uri, 'net-list --all'));
  return parseNetworkList(stdout);
}

/** Checks whether a network is defined. */
export async function networkExists(options: NetworkOptions): Promise<boolean> {
  const { name, uri } = options;
  return (await _tryVirshXml(_virsh(uri, `net-dumpxml ${$_(name)}`))) !== undefined;
}

/** Returns the live XML of a network. Throws when not defined. */
export async function getNetworkXml(options: NetworkOptions): Promise<string> {
  const { name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `net-dumpxml ${$_(name)}`));
  return stdout;
}

/** Returns the normalized configuration of a defined network. */
export async function getNetwork(options: NetworkOptions): Promise<NetworkConf> {
  return parseNetworkXml(await getNetworkXml(options));
}

/** Network details from `virsh net-info`. */
export interface NetworkInfo {
  readonly name: string;
  readonly active: boolean;
  readonly autostart: boolean;
  readonly persistent: boolean;
  readonly bridge: string | undefined;
}

/** Parses `virsh net-info` output. */
export function parseNetworkInfo(output: string): NetworkInfo {
  const info = _parseInfoBlock(output);
  const name = info['Name'];
  if (name === undefined || name === '') {
    throw new Error('invalid net-info output: missing Name');
  }
  const bridge = info['Bridge'];
  return {
    name,
    active: info['Active'] === 'yes',
    autostart: info['Autostart'] === 'yes',
    persistent: info['Persistent'] === 'yes',
    bridge: bridge === undefined || bridge === '' ? undefined : bridge,
  };
}

/** Returns network details from `virsh net-info`. */
export async function getNetworkInfo(options: NetworkOptions): Promise<NetworkInfo> {
  const { name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `net-info ${$_(name)}`));
  return parseNetworkInfo(stdout);
}

/** Options for `defineNetwork()`: normalized config or raw XML. */
export type DefineNetworkOptions = VirshOptions &
  (
    | { readonly network: NetworkConf }
    | {
        /** Raw network XML for options outside the normalized model. */
        readonly xml: string;
        readonly name: string;
        /**
         * Redefine even when the network already exists. Without this, an
         * existing network is left untouched (raw XML is compared by
         * existence only, since libvirt reformats XML on define).
         */
        readonly update?: boolean;
      }
  );

/**
 * **[IDEMPOTENT]** Defines a network from a normalized config or raw XML.
 *
 * The normalized path compares `virsh net-dumpxml` output field-by-field
 * (unspecified fields are wildcards) and redefines only on drift. The raw
 * XML path defines by existence unless `update` is set.
 */
export async function defineNetwork(options: DefineNetworkOptions): Promise<void> {
  if ('network' in options) {
    const { network, uri } = options;
    return task(
      `virsh net-define ${network.name}`,
      async (ctx) => {
        const current = await _tryVirshXml(_virsh(uri, `net-dumpxml ${$_(network.name)}`));
        if (current !== undefined && networkConfigMatches(parseNetworkXml(current), network)) {
          return;
        }
        const xml = serializeNetworkXml(network);
        if (!ctx.dryRun) {
          await withTempFile(
            async (path) => {
              await sh(_virsh(uri, `net-define ${$_(path)}`));
            },
            { content: xml, template: VIRSH_XML_TEMPLATE },
          );
        }
        emitChanged({
          type: 'network',
          resource: network.name,
          property: current === undefined ? 'defined' : 'redefined',
          to: 'true',
        });
      },
      { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
    );
  }

  const { name, xml, uri, update } = options;
  return task(
    `virsh net-define ${name}`,
    async (ctx) => {
      const current = await _tryVirshXml(_virsh(uri, `net-dumpxml ${$_(name)}`));
      if (current !== undefined && update !== true) {
        return;
      }
      if (!ctx.dryRun) {
        await withTempFile(
          async (path) => {
            await sh(_virsh(uri, `net-define ${$_(path)}`));
          },
          { content: xml, template: VIRSH_XML_TEMPLATE },
        );
      }
      emitChanged({
        type: 'network',
        resource: name,
        property: current === undefined ? 'defined' : 'redefined',
        to: 'true',
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Undefines a network. Does nothing when not defined.
 *
 * The network must be inactive first (`destroyNetwork()` stops an active
 * one).
 */
export async function undefineNetwork(options: NetworkOptions): Promise<void> {
  const { name, uri } = options;
  return task(
    `virsh net-undefine ${name}`,
    async (ctx) => {
      const current = await _tryVirshXml(_virsh(uri, `net-dumpxml ${$_(name)}`));
      if (current === undefined) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `net-undefine ${$_(name)}`));
      }
      emitChanged({ type: 'network', resource: name, property: 'state', to: 'undefined' });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Starts a network. Returns true when it was started.
 */
export async function startNetwork(options: NetworkOptions): Promise<boolean> {
  const { name, uri } = options;
  return task(
    `virsh net-start ${name}`,
    async (ctx) => {
      const info = await getNetworkInfo(options);
      if (info.active) {
        return false;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `net-start ${$_(name)}`));
      }
      emitChanged({
        type: 'network',
        resource: name,
        property: 'state',
        from: 'inactive',
        to: 'active',
      });
      return true;
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Stops an active network. Does nothing when inactive.
 */
export async function destroyNetwork(options: NetworkOptions): Promise<void> {
  const { name, uri } = options;
  return task(
    `virsh net-destroy ${name}`,
    async (ctx) => {
      const info = await getNetworkInfo(options);
      if (!info.active) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `net-destroy ${$_(name)}`));
      }
      emitChanged({
        type: 'network',
        resource: name,
        property: 'state',
        from: 'active',
        to: 'inactive',
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/** Options for `setNetworkAutostart()`. */
export interface SetNetworkAutostartOptions extends NetworkOptions {
  readonly autostart: boolean;
}

/**
 * **[IDEMPOTENT]** Enables or disables network autostart.
 */
export async function setNetworkAutostart(options: SetNetworkAutostartOptions): Promise<void> {
  const { name, uri, autostart } = options;
  return task(
    `virsh net-autostart ${name}`,
    async (ctx) => {
      const info = await getNetworkInfo(options);
      if (info.autostart === autostart) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `net-autostart ${autostart ? '' : '--disable '}${$_(name)}`));
      }
      emitChanged({
        type: 'network',
        resource: name,
        property: 'autostart',
        from: String(info.autostart),
        to: String(autostart),
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}
