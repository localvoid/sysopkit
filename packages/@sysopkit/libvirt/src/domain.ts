/**
 * @module domain
 *
 * Libvirt domain (virtual machine) management with a normalized TypeScript
 * API.
 *
 * Define guests with `DomainConf` instead of hand-writing XML; `virsh`
 * remains the transport and `Bun.XML` (see `@sysopkit/libvirt/xml`) handles
 * XML, so this module only runs on the Bun runtime.
 *
 * Domains with devices outside the normalized model (host PCI passthrough,
 * TPM, NUMA tuning, ...) can still be managed through the raw XML path of
 * `defineDomain()` (`{ name, xml }`), which defines by existence and only
 * redefines with `update: true`.
 *
 * @see virsh(1) - management user interface for libvirt guests and hypervisor
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';
import { withTempFile } from 'sysopkit/op/temp';

import {
  _parseInfoBlock,
  _parseListTable,
  _sizeToMiB,
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
  xmlText,
  type MutableXmlElement,
  type XmlDocument,
  type XmlElement,
  type XmlValue,
} from './xml.js';

/** Runtime state of a domain as reported by `virsh domstate` / `dominfo`. */
export type DomainState =
  | 'running'
  | 'idle'
  | 'paused'
  | 'shutdown'
  | 'shutoff'
  | 'crashed'
  | 'dying'
  | 'pmsuspended'
  | 'unknown';

/** Normalizes virsh state output (`shut off` -> `shutoff`). */
export function normalizeDomainState(raw: string): DomainState {
  const state = raw.trim().toLowerCase().replace(/\s+/g, '');
  switch (state) {
    case 'running':
    case 'idle':
    case 'paused':
    case 'shutdown':
    case 'shutoff':
    case 'crashed':
    case 'dying':
    case 'pmsuspended':
      return state;
    default:
      return 'unknown';
  }
}

/** Disk bus types modeled by `DomainDisk`. */
export type DomainDiskBus = 'virtio' | 'scsi' | 'sata' | 'ide';

/** Disk image formats modeled by `DomainDisk`. */
export type DomainDiskFormat = 'qcow2' | 'raw';

/** A virtual disk attached to a domain. */
export interface DomainDisk {
  /** Host path to the image (file) or device (block). */
  readonly source: string;
  /** Guest target name (`vda`, `sda`, ...). Defaults to `vdX`/`sdX` in order. */
  readonly target?: string;
  /** Guest bus. Default: `virtio`. */
  readonly bus?: DomainDiskBus;
  /** Image format for the qemu driver. Default: `qcow2`. */
  readonly format?: DomainDiskFormat;
  /** Backing store kind. Default: `file`. */
  readonly kind?: 'file' | 'block';
  /**
   * Device class. Default: `disk`. Use `cdrom` for attached ISO images
   * (e.g. a persistent seed image).
   */
  readonly device?: 'disk' | 'cdrom';
  /** Attach read-only (`<readonly/>`). */
  readonly readonly?: boolean;
  /** Boot order index (`<boot order="N"/>`). */
  readonly bootOrder?: number;
}

/** Network interface attachment types modeled by `DomainInterface`. */
export type DomainInterfaceType = 'network' | 'bridge';

/** A virtual network interface attached to a domain. */
export interface DomainInterface {
  /** Attachment type. Default: `network`. */
  readonly type?: DomainInterfaceType;
  /** Source libvirt network name (`network`) or host bridge name (`bridge`). */
  readonly source: string;
  /** Device model. Default: `virtio`. */
  readonly model?: 'virtio' | 'e1000' | 'rtl8139';
  /** MAC address. When omitted, libvirt assigns one. */
  readonly mac?: string;
  /** Boot order index (`<boot order="N"/>`). */
  readonly bootOrder?: number;
}

/** Graphical console types modeled by `DomainGraphics`. */
export type DomainGraphicsType = 'spice' | 'vnc';

/** Graphical console configuration (`graphics: 'none'` omits the device). */
export interface DomainGraphics {
  readonly type: DomainGraphicsType;
  /** Listen scope. Default: `none` (no network exposure). */
  readonly listen?: 'none' | 'localhost';
}

/** UEFI firmware description with explicit loader paths. */
export interface DomainUefi {
  /** Firmware code image (e.g. `/usr/share/edk2/ovmf/OVMF_CODE.fd`). */
  readonly loader: string;
  /** Variable template (e.g. `.../OVMF_VARS.fd`). */
  readonly template?: string;
  /**
   * Per-domain variable store. Defaults to
   * `/var/lib/libvirt/qemu/nvram/<name>_VARS.fd`.
   */
  readonly nvram?: string;
}

/**
 * Normalized domain (virtual machine) configuration.
 *
 * Only the modeled subset participates in idempotency checks: fields left
 * undefined act as wildcards when comparing against `virsh dumpxml` output
 * (see `domainConfigMatches`). Libvirt-assigned values (UUID, generated MAC,
 * emulator path, auto-added video/memballoon) are ignored.
 */
export interface DomainConf {
  /** Domain name. */
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  /** RAM in MiB (written as `<memory>` and `<currentMemory>`). */
  readonly memoryMiB: number;
  /** Virtual CPU count. */
  readonly vcpus: number;
  /** Hypervisor type. Default: `kvm`. */
  readonly type?: 'kvm' | 'qemu';
  /** Guest architecture. Default: `x86_64`. */
  readonly arch?: 'x86_64' | 'aarch64';
  /** Machine type (e.g. `q35`). When omitted, the libvirt default is used. */
  readonly machine?: string;
  /** Firmware. Default: `bios`. */
  readonly firmware?: 'bios' | DomainUefi;
  /** CPU mode (`<cpu mode="..."/>`). When omitted, no `<cpu>` is written. */
  readonly cpuMode?: 'host-passthrough' | 'host-model';
  /** Boot device order. Default: `['hd']`. */
  readonly bootDevices?: readonly ('hd' | 'cdrom' | 'network')[];
  /** Attached disks (targets default to `vdX`/`sdX` in order). */
  readonly disks?: readonly DomainDisk[];
  /** Attached network interfaces. */
  readonly networks?: readonly DomainInterface[];
  /** Graphical console. Default: spice with no network listener. */
  readonly graphics?: DomainGraphics | 'none';
  /** Attach the qemu-guest-agent virtio channel. Default: false. */
  readonly agent?: boolean;
  /** Attach serial + console pty devices (for `virsh console`). Default: true. */
  readonly consoles?: boolean;
}

/** Suffix for default disk targets: 0 -> `a`, 25 -> `z`, 26 -> `aa`. */
function _targetSuffix(index: number): string {
  let s = '';
  let i = index;
  do {
    s = String.fromCharCode(97 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}

/**
 * Serializes a normalized domain configuration to libvirt domain XML.
 *
 * The output is fully explicit (defaulted bus/model/format/listen values
 * are written out) so that `virsh define` converges.
 */
export function serializeDomainXml(domain: DomainConf): string {
  if (domain.name === '') {
    throw new Error('domain name must not be empty');
  }
  if (!Number.isFinite(domain.memoryMiB) || domain.memoryMiB <= 0) {
    throw new Error(`invalid memoryMiB '${domain.memoryMiB}'`);
  }
  if (!Number.isInteger(domain.vcpus) || domain.vcpus <= 0) {
    throw new Error(`invalid vcpus '${domain.vcpus}'`);
  }

  const arch = domain.arch ?? 'x86_64';
  const bootDevices = domain.bootDevices ?? ['hd'];
  const disks = domain.disks ?? [];
  const networks = domain.networks ?? [];

  const os: MutableXmlElement = {
    type: {
      '@arch': arch,
      ...(domain.machine === undefined ? {} : { '@machine': domain.machine }),
      '#text': 'hvm',
    },
    boot: bootDevices.map((dev) => ({ '@dev': dev })),
  };
  if (typeof domain.firmware === 'object') {
    os['loader'] = {
      '@readonly': 'yes',
      '@type': 'pflash',
      '#text': domain.firmware.loader,
    };
    const nvram: MutableXmlElement = {
      '#text': domain.firmware.nvram ?? `/var/lib/libvirt/qemu/nvram/${domain.name}_VARS.fd`,
    };
    if (domain.firmware.template !== undefined) {
      nvram['@template'] = domain.firmware.template;
    }
    os['nvram'] = nvram;
  }

  const devices: MutableXmlElement = {
    disk: disks.map((disk, i) => {
      const bus = disk.bus ?? 'virtio';
      const target = disk.target ?? `${bus === 'virtio' ? 'vd' : 'sd'}${_targetSuffix(i)}`;
      const sourceAttr = disk.kind === 'block' ? '@dev' : '@file';
      const entry: MutableXmlElement = {
        '@type': disk.kind ?? 'file',
        '@device': disk.device ?? 'disk',
        'driver': { '@name': 'qemu', '@type': disk.format ?? 'qcow2' },
        'source': { [sourceAttr]: disk.source },
        'target': { '@dev': target, '@bus': bus },
      };
      if (disk.readonly === true) {
        entry['readonly'] = '';
      }
      if (disk.bootOrder !== undefined) {
        entry['boot'] = { '@order': String(disk.bootOrder) };
      }
      return entry;
    }),
    interface: networks.map((iface) => {
      const type = iface.type ?? 'network';
      const entry: MutableXmlElement = {
        '@type': type,
        'source': type === 'bridge' ? { '@bridge': iface.source } : { '@network': iface.source },
        'model': { '@type': iface.model ?? 'virtio' },
      };
      if (iface.mac !== undefined) {
        entry['mac'] = { '@address': iface.mac };
      }
      if (iface.bootOrder !== undefined) {
        entry['boot'] = { '@order': String(iface.bootOrder) };
      }
      return entry;
    }),
  };
  if (domain.consoles ?? true) {
    devices['serial'] = { '@type': 'pty', 'target': { '@port': '0' } };
    devices['console'] = { '@type': 'pty', 'target': { '@type': 'serial', '@port': '0' } };
  }
  if (domain.agent === true) {
    devices['channel'] = {
      '@type': 'unix',
      'target': { '@type': 'virtio', '@name': 'org.qemu.guest_agent.0' },
    };
  }
  const graphics = domain.graphics ?? { type: 'spice' as const };
  if (graphics !== 'none') {
    devices['graphics'] = {
      '@type': graphics.type,
      'listen': { '@type': graphics.listen ?? 'none' },
    };
  }

  const root: MutableXmlElement = {
    '@type': domain.type ?? 'kvm',
    'name': domain.name,
    ...(domain.title === undefined ? {} : { title: domain.title }),
    ...(domain.description === undefined ? {} : { description: domain.description }),
    'memory': { '@unit': 'MiB', '#text': String(domain.memoryMiB) },
    'currentMemory': { '@unit': 'MiB', '#text': String(domain.memoryMiB) },
    'vcpu': { '@placement': 'static', '#text': String(domain.vcpus) },
    os,
    'features': arch === 'aarch64' ? { gic: '' } : { acpi: '', apic: '' },
    ...(domain.cpuMode === undefined ? {} : { cpu: { '@mode': domain.cpuMode } }),
    devices,
  };
  const doc: XmlDocument = { domain: root };
  return stringifyXmlDocument(doc);
}

/** Reads an `<memory>`-style element value into MiB. */
function _parseSizedElement(el: XmlElement | string | undefined, what: string): number | undefined {
  if (el === undefined) {
    return undefined;
  }
  if (typeof el === 'string') {
    const amount = Number(el.trim());
    return Number.isFinite(amount) ? amount : undefined;
  }
  const text = xmlText(el);
  if (text === undefined) {
    throw new Error(`invalid domain XML: <${what}> has no text`);
  }
  return Math.round(_sizeToMiB(`${text} ${xmlAttr(el, 'unit') ?? 'MiB'}`));
}

/**
 * Parses libvirt domain XML (e.g. `virsh dumpxml` output) into the normalized
 * model, keeping only the modeled subset.
 *
 * Throws on missing required fields (`name`, `memory`, `vcpu`) and on disk
 * or interface types outside the model (use the raw XML path for those).
 */
export function parseDomainXml(xml: string): DomainConf {
  const doc = parseXmlDocument(xml);
  const root = doc['domain'];
  if (!isXmlElement(root)) {
    throw new Error('invalid domain XML: missing <domain> root');
  }

  const name = childText(root, 'name');
  if (name === undefined) {
    throw new Error('invalid domain XML: missing <name>');
  }
  const memoryMiB = _parseSizedElement(childElement(root, 'memory'), 'memory');
  if (memoryMiB === undefined) {
    throw new Error('invalid domain XML: missing <memory>');
  }
  const vcpuText = xmlText(childElement(root, 'vcpu'));
  const vcpus = vcpuText === undefined ? Number.NaN : parseInt(vcpuText, 10);
  if (!Number.isInteger(vcpus) || vcpus <= 0) {
    throw new Error('invalid domain XML: missing <vcpu>');
  }

  const osEl = childElement(root, 'os');
  const osTypeEl = isXmlElement(osEl) ? childElement(osEl, 'type') : undefined;
  const arch = isXmlElement(osTypeEl) ? (xmlAttr(osTypeEl, 'arch') ?? 'x86_64') : 'x86_64';
  if (arch !== 'x86_64' && arch !== 'aarch64') {
    throw new Error(`unsupported domain arch '${arch}'`);
  }
  const machine = isXmlElement(osTypeEl) ? xmlAttr(osTypeEl, 'machine') : undefined;
  const boot = isXmlElement(osEl)
    ? asArray<XmlValue>(osEl['boot'] as XmlValue | undefined)
        .map((b) => (isXmlElement(b) ? xmlAttr(b, 'dev') : undefined))
        .filter((d) => d === 'hd' || d === 'cdrom' || d === 'network')
    : [];

  let firmware: DomainConf['firmware'] = 'bios';
  if (isXmlElement(osEl)) {
    const loaderEl = childElement(osEl, 'loader');
    const loader = xmlText(loaderEl);
    if (loader !== undefined) {
      const nvramEl = childElement(osEl, 'nvram');
      firmware = {
        loader,
        ...(isXmlElement(nvramEl) && xmlAttr(nvramEl, 'template') !== undefined
          ? { template: xmlAttr(nvramEl, 'template') as string }
          : {}),
        ...(xmlText(nvramEl) !== undefined ? { nvram: xmlText(nvramEl) as string } : {}),
      };
    } else if (xmlAttr(osEl, 'firmware') === 'efi') {
      throw new Error(
        'UEFI domain without an explicit <loader> path is outside the normalized model' +
          ' (use the raw XML path of defineDomain)',
      );
    }
  }

  const cpuEl = childElement(root, 'cpu');
  const cpuMode = isXmlElement(cpuEl) ? xmlAttr(cpuEl, 'mode') : undefined;

  const devicesEl = childElement(root, 'devices');
  const devices = isXmlElement(devicesEl) ? devicesEl : undefined;

  const disks: DomainDisk[] = asArray<XmlValue>(devices?.['disk']).map((d) => {
    if (!isXmlElement(d)) {
      throw new Error('invalid domain XML: <disk> must be an element');
    }
    const kind = xmlAttr(d, 'type') ?? 'file';
    if (kind !== 'file' && kind !== 'block') {
      throw new Error(
        `disk type '${kind}' is outside the normalized model (use the raw XML path of defineDomain)`,
      );
    }
    const device = xmlAttr(d, 'device') ?? 'disk';
    if (device !== 'disk' && device !== 'cdrom') {
      throw new Error(
        `disk device '${device}' is outside the normalized model (use the raw XML path of defineDomain)`,
      );
    }
    const sourceEl = childElement(d, 'source');
    const source = isXmlElement(sourceEl)
      ? (xmlAttr(sourceEl, kind === 'block' ? 'dev' : 'file') ?? '')
      : '';
    const targetEl = childElement(d, 'target');
    const driverEl = childElement(d, 'driver');
    const bootEl = childElement(d, 'boot');
    const bus = isXmlElement(targetEl) ? xmlAttr(targetEl, 'bus') : undefined;
    const format = isXmlElement(driverEl) ? xmlAttr(driverEl, 'type') : undefined;
    return {
      source,
      ...(isXmlElement(targetEl) && xmlAttr(targetEl, 'dev') !== undefined
        ? { target: xmlAttr(targetEl, 'dev') as string }
        : {}),
      ...(bus === 'virtio' || bus === 'scsi' || bus === 'sata' || bus === 'ide' ? { bus } : {}),
      ...(format === 'qcow2' || format === 'raw' ? { format } : {}),
      ...(kind === 'file' ? {} : { kind: kind as 'block' }),
      ...(device === 'disk' ? {} : { device: device as 'cdrom' }),
      ...('readonly' in d ? { readonly: true as const } : {}),
      ...(isXmlElement(bootEl) && xmlAttr(bootEl, 'order') !== undefined
        ? { bootOrder: parseInt(xmlAttr(bootEl, 'order') as string, 10) }
        : {}),
    };
  });

  const networks: DomainInterface[] = asArray<XmlValue>(devices?.['interface']).map((n) => {
    if (!isXmlElement(n)) {
      throw new Error('invalid domain XML: <interface> must be an element');
    }
    const type = xmlAttr(n, 'type') ?? 'network';
    if (type !== 'network' && type !== 'bridge') {
      throw new Error(
        `interface type '${type}' is outside the normalized model` +
          ' (use the raw XML path of defineDomain)',
      );
    }
    const sourceEl = childElement(n, 'source');
    const source = isXmlElement(sourceEl)
      ? (xmlAttr(sourceEl, type === 'bridge' ? 'bridge' : 'network') ?? '')
      : '';
    const modelEl = childElement(n, 'model');
    const model = isXmlElement(modelEl) ? xmlAttr(modelEl, 'type') : undefined;
    const macEl = childElement(n, 'mac');
    const bootEl = childElement(n, 'boot');
    return {
      ...(type === 'network' ? {} : { type: type as 'bridge' }),
      source,
      ...(model === 'virtio' || model === 'e1000' || model === 'rtl8139' ? { model } : {}),
      ...(isXmlElement(macEl) && xmlAttr(macEl, 'address') !== undefined
        ? { mac: xmlAttr(macEl, 'address') as string }
        : {}),
      ...(isXmlElement(bootEl) && xmlAttr(bootEl, 'order') !== undefined
        ? { bootOrder: parseInt(xmlAttr(bootEl, 'order') as string, 10) }
        : {}),
    };
  });

  const graphicsEl = childElement(devices, 'graphics');
  const graphicsType = isXmlElement(graphicsEl) ? xmlAttr(graphicsEl, 'type') : undefined;
  const listenEl = isXmlElement(graphicsEl) ? childElement(graphicsEl, 'listen') : undefined;
  const listen = isXmlElement(listenEl) ? xmlAttr(listenEl, 'type') : undefined;

  const channels = asArray<XmlValue>(devices?.['channel']);
  const agent = channels.some((c) => {
    if (!isXmlElement(c)) {
      return false;
    }
    const target = childElement(c, 'target');
    return (
      isXmlElement(target) &&
      xmlAttr(target, 'type') === 'virtio' &&
      xmlAttr(target, 'name') === 'org.qemu.guest_agent.0'
    );
  });

  const hasSerial =
    childElement(devices, 'serial') !== undefined || childElement(devices, 'console') !== undefined;

  return {
    name,
    ...(childText(root, 'title') === undefined
      ? {}
      : { title: childText(root, 'title') as string }),
    ...(childText(root, 'description') === undefined
      ? {}
      : { description: childText(root, 'description') as string }),
    memoryMiB,
    vcpus,
    ...(xmlAttr(root, 'type') === 'qemu' ? { type: 'qemu' as const } : {}),
    ...(arch === 'x86_64' ? {} : { arch }),
    ...(machine === undefined ? {} : { machine }),
    firmware,
    ...(cpuMode === 'host-passthrough' || cpuMode === 'host-model' ? { cpuMode } : {}),
    ...(boot.length === 0 ? {} : { bootDevices: boot as ('hd' | 'cdrom' | 'network')[] }),
    ...(disks.length === 0 ? {} : { disks }),
    ...(networks.length === 0 ? {} : { networks }),
    ...(graphicsType === 'spice' || graphicsType === 'vnc'
      ? {
          graphics: {
            type: graphicsType,
            ...(listen === 'none' || listen === 'localhost' ? { listen } : {}),
          },
        }
      : { graphics: 'none' as const }),
    ...(agent ? { agent: true as const } : {}),
    consoles: hasSerial,
  };
}

/**
 * Compares live configuration against desired configuration.
 *
 * Fields left undefined in `desired` act as wildcards (libvirt-assigned
 * values such as generated MACs or defaulted machine types never cause a
 * mismatch). Array entries compare positionally.
 */
export function domainConfigMatches(current: DomainConf, desired: DomainConf): boolean {
  if (current.name !== desired.name) {
    return false;
  }
  if (desired.type !== undefined && desired.type !== (current.type ?? 'kvm')) {
    return false;
  }
  if (desired.arch !== undefined && desired.arch !== (current.arch ?? 'x86_64')) {
    return false;
  }
  if (desired.machine !== undefined && desired.machine !== current.machine) {
    return false;
  }
  if (current.memoryMiB !== desired.memoryMiB || current.vcpus !== desired.vcpus) {
    return false;
  }
  if (desired.title !== undefined && desired.title !== current.title) {
    return false;
  }
  if (desired.description !== undefined && desired.description !== current.description) {
    return false;
  }
  if (
    desired.firmware !== undefined &&
    !_firmwareMatches(current.firmware ?? 'bios', desired.firmware)
  ) {
    return false;
  }
  if (desired.cpuMode !== undefined && desired.cpuMode !== current.cpuMode) {
    return false;
  }
  if (
    desired.bootDevices !== undefined &&
    (desired.bootDevices.length !== (current.bootDevices ?? ['hd']).length ||
      desired.bootDevices.some((d, i) => d !== (current.bootDevices ?? ['hd'])[i]))
  ) {
    return false;
  }
  const desiredDisks = desired.disks ?? [];
  const currentDisks = current.disks ?? [];
  if (
    desired.disks !== undefined &&
    (desiredDisks.length !== currentDisks.length ||
      desiredDisks.some((d, i) => !_diskMatches(currentDisks[i], d)))
  ) {
    return false;
  }
  if (
    desired.networks !== undefined &&
    ((current.networks ?? []).length !== desired.networks.length ||
      desired.networks.some((n, i) => !_interfaceMatches((current.networks ?? [])[i], n)))
  ) {
    return false;
  }
  if (desired.graphics !== undefined) {
    const want = desired.graphics === 'none' ? undefined : desired.graphics;
    const have = current.graphics === 'none' ? undefined : (current.graphics as DomainGraphics);
    if (want === undefined) {
      if (have !== undefined) {
        return false;
      }
    } else {
      if (have === undefined || have.type !== want.type) {
        return false;
      }
      if (want.listen !== undefined && want.listen !== have.listen) {
        return false;
      }
    }
  }
  if (desired.agent !== undefined && (current.agent ?? false) !== desired.agent) {
    return false;
  }
  if (desired.consoles !== undefined && (current.consoles ?? true) !== desired.consoles) {
    return false;
  }
  return true;
}

function _firmwareMatches(current: 'bios' | DomainUefi, desired: 'bios' | DomainUefi): boolean {
  if (desired === 'bios') {
    return current === 'bios';
  }
  if (current === 'bios') {
    return false;
  }
  if (current.loader !== desired.loader) {
    return false;
  }
  if (desired.template !== undefined && desired.template !== current.template) {
    return false;
  }
  if (desired.nvram !== undefined && desired.nvram !== current.nvram) {
    return false;
  }
  return true;
}

function _diskMatches(current: DomainDisk, desired: DomainDisk): boolean {
  if (current.source !== desired.source) {
    return false;
  }
  if (desired.target !== undefined && desired.target !== current.target) {
    return false;
  }
  if (desired.bus !== undefined && desired.bus !== (current.bus ?? 'virtio')) {
    return false;
  }
  if (desired.format !== undefined && desired.format !== (current.format ?? 'qcow2')) {
    return false;
  }
  if (desired.kind !== undefined && desired.kind !== (current.kind ?? 'file')) {
    return false;
  }
  if (desired.device !== undefined && desired.device !== (current.device ?? 'disk')) {
    return false;
  }
  if (desired.readonly !== undefined && desired.readonly !== (current.readonly ?? false)) {
    return false;
  }
  if (desired.bootOrder !== undefined && desired.bootOrder !== current.bootOrder) {
    return false;
  }
  return true;
}

function _interfaceMatches(current: DomainInterface, desired: DomainInterface): boolean {
  if ((desired.type ?? 'network') !== (current.type ?? 'network')) {
    return false;
  }
  if (current.source !== desired.source) {
    return false;
  }
  if (desired.model !== undefined && desired.model !== (current.model ?? 'virtio')) {
    return false;
  }
  if (desired.mac !== undefined && desired.mac !== current.mac) {
    return false;
  }
  if (desired.bootOrder !== undefined && desired.bootOrder !== current.bootOrder) {
    return false;
  }
  return true;
}

/** Options for domain operations that address a domain by name. */
export interface DomainOptions extends VirshOptions {
  readonly name: string;
}

/** A domain entry from `virsh list --all`. */
export interface DomainListEntry {
  readonly name: string;
  readonly state: DomainState;
}

/**
 * Parses `virsh list --all` table output.
 *
 * Skips the header and separator lines; multi-word states (`shut off`) are
 * joined back before normalization.
 */
export function parseDomainList(output: string): DomainListEntry[] {
  return _parseListTable(output)
    .filter((cols) => cols.length >= 3)
    .map((cols) => ({
      name: cols[1],
      state: normalizeDomainState(cols.slice(2).join(' ')),
    }));
}

/** Lists all domains (running and defined) via `virsh list --all`. */
export async function listDomains(options?: VirshOptions): Promise<DomainListEntry[]> {
  const { stdout } = await sh(_virsh(options?.uri, 'list --all'));
  return parseDomainList(stdout);
}

/** Checks whether a domain is defined. */
export async function domainExists(options: DomainOptions): Promise<boolean> {
  const { name, uri } = options;
  return (await _tryVirshXml(_virsh(uri, `dumpxml ${$_(name)}`))) !== undefined;
}

/** Options for `getDomainXml()`. */
export interface GetDomainXmlOptions extends DomainOptions {
  /**
   * Dump the inactive (persistent) configuration that will be used on next
   * start instead of the live state (`dumpxml --inactive`). Needed for
   * snapshot verification and offline config inspection.
   */
  readonly inactive?: boolean;
}

/**
 * Returns the XML of a domain. Throws when the domain is not defined.
 */
export async function getDomainXml(options: GetDomainXmlOptions): Promise<string> {
  const { name, uri, inactive } = options;
  const { stdout } = await sh(
    _virsh(uri, `dumpxml${inactive === true ? ' --inactive' : ''} ${$_(name)}`),
  );
  return stdout;
}

/** Returns the normalized configuration of a defined domain. */
export async function getDomain(options: DomainOptions): Promise<DomainConf> {
  return parseDomainXml(await getDomainXml(options));
}

/** Returns the runtime state of a domain. Throws when not defined. */
export async function getDomainState(options: DomainOptions): Promise<DomainState> {
  const { name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `domstate ${$_(name)}`));
  return normalizeDomainState(stdout);
}

/** Domain details from `virsh dominfo`. */
export interface DomainInfo {
  /** Domain ID, undefined when inactive (`-`). */
  readonly id: number | undefined;
  readonly name: string;
  readonly state: DomainState;
  readonly vcpus: number;
  readonly maxMemoryMiB: number;
  readonly memoryMiB: number;
  readonly persistent: boolean;
  readonly autostart: boolean;
}

/** Parses `virsh dominfo` output. */
export function parseDomainInfo(output: string): DomainInfo {
  const info = _parseInfoBlock(output);
  const name = info['Name'];
  if (name === undefined || name === '') {
    throw new Error('invalid dominfo output: missing Name');
  }
  const idRaw = info['Id'];
  const id = idRaw === undefined || idRaw === '-' ? undefined : parseInt(idRaw, 10);
  const vcpus = parseInt(info['CPU(s)'] ?? '', 10);
  const maxMemoryMiB = Math.round(_sizeToMiB(info['Max memory'] ?? ''));
  const memoryMiB = Math.round(_sizeToMiB(info['Used memory'] ?? ''));
  if (!Number.isInteger(vcpus) || !Number.isFinite(maxMemoryMiB) || !Number.isFinite(memoryMiB)) {
    throw new Error('invalid dominfo output: bad CPU/memory values');
  }
  return {
    id,
    name,
    state: normalizeDomainState(info['State'] ?? ''),
    vcpus,
    maxMemoryMiB,
    memoryMiB,
    persistent: info['Persistent'] === 'yes',
    autostart: info['Autostart'] === 'enable',
  };
}

/** Returns domain details from `virsh dominfo`. */
export async function getDomainInfo(options: DomainOptions): Promise<DomainInfo> {
  const { name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `dominfo ${$_(name)}`));
  return parseDomainInfo(stdout);
}

/** Options for `defineDomain()`: normalized config or raw XML. */
export type DefineDomainOptions = VirshOptions &
  (
    | { readonly domain: DomainConf }
    | {
        /** Raw domain XML for devices outside the normalized model. */
        readonly xml: string;
        readonly name: string;
        /**
         * Redefine even when the domain already exists. Without this, an
         * existing domain is left untouched (raw XML is compared by
         * existence only, since libvirt reformats XML on define).
         */
        readonly update?: boolean;
      }
  );

/**
 * **[IDEMPOTENT]** Defines a domain from a normalized config or raw XML.
 *
 * The normalized path compares `virsh dumpxml` output field-by-field
 * (unspecified fields are wildcards) and redefines only on drift. The raw
 * XML path defines by existence unless `update` is set.
 */
export async function defineDomain(options: DefineDomainOptions): Promise<void> {
  if ('domain' in options) {
    const { domain, uri } = options;
    return task(
      `virsh define ${domain.name}`,
      async (ctx) => {
        const current = await _tryVirshXml(_virsh(uri, `dumpxml ${$_(domain.name)}`));
        if (current !== undefined && domainConfigMatches(parseDomainXml(current), domain)) {
          return;
        }
        const xml = serializeDomainXml(domain);
        if (!ctx.dryRun) {
          await withTempFile(
            async (path) => {
              await sh(_virsh(uri, `define ${$_(path)}`));
            },
            { content: xml, template: VIRSH_XML_TEMPLATE },
          );
        }
        emitChanged({
          type: 'domain',
          resource: domain.name,
          property: current === undefined ? 'defined' : 'redefined',
          to: 'true',
        });
      },
      { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
    );
  }

  const { name, xml, uri, update } = options;
  return task(
    `virsh define ${name}`,
    async (ctx) => {
      const current = await _tryVirshXml(_virsh(uri, `dumpxml ${$_(name)}`));
      if (current !== undefined && update !== true) {
        return;
      }
      if (!ctx.dryRun) {
        await withTempFile(
          async (path) => {
            await sh(_virsh(uri, `define ${$_(path)}`));
          },
          { content: xml, template: VIRSH_XML_TEMPLATE },
        );
      }
      emitChanged({
        type: 'domain',
        resource: name,
        property: current === undefined ? 'defined' : 'redefined',
        to: 'true',
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/** Options for `undefineDomain()`. */
export interface UndefineDomainOptions extends DomainOptions {
  /** Also remove UEFI nvram (`--nvram`). */
  readonly removeNvram?: boolean;
  /**
   * Also clean up snapshot metadata (`--snapshots-metadata`). Required to
   * undefine an inactive domain that has snapshots; ignored for active
   * domains.
   */
  readonly snapshotsMetadata?: boolean;
}

/**
 * **[IDEMPOTENT]** Undefines a domain. Does nothing when not defined.
 *
 * The domain must be shut off first (`destroyDomain()` stops a running one,
 * but defined storage volumes are left behind).
 */
export async function undefineDomain(options: UndefineDomainOptions): Promise<void> {
  const { name, uri, removeNvram, snapshotsMetadata } = options;
  return task(
    `virsh undefine ${name}`,
    async (ctx) => {
      const current = await _tryVirshXml(_virsh(uri, `dumpxml ${$_(name)}`));
      if (current === undefined) {
        return;
      }
      if (!ctx.dryRun) {
        const flags = `${snapshotsMetadata === true ? ' --snapshots-metadata' : ''}${removeNvram === true ? ' --nvram' : ''}`;
        await sh(_virsh(uri, `undefine ${$_(name)}${flags}`));
      }
      emitChanged({ type: 'domain', resource: name, property: 'state', to: 'undefined' });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Starts a domain. Returns true when it was started.
 */
export async function startDomain(options: DomainOptions): Promise<boolean> {
  const { name, uri } = options;
  return task(
    `virsh start ${name}`,
    async (ctx) => {
      const state = await getDomainState(options);
      if (state === 'running') {
        return false;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `start ${$_(name)}`));
      }
      emitChanged({
        type: 'domain',
        resource: name,
        property: 'state',
        from: state,
        to: 'running',
      });
      return true;
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Gracefully shuts down a running domain (ACPI). Does
 * nothing unless the domain is running.
 */
export async function shutdownDomain(options: DomainOptions): Promise<void> {
  const { name, uri } = options;
  return task(
    `virsh shutdown ${name}`,
    async (ctx) => {
      const state = await getDomainState(options);
      if (state !== 'running') {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `shutdown ${$_(name)}`));
      }
      emitChanged({
        type: 'domain',
        resource: name,
        property: 'state',
        from: state,
        to: 'shutoff',
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Force-stops a domain (power off). Does nothing unless the
 * domain is running, paused, crashed, or dying.
 */
export async function destroyDomain(options: DomainOptions): Promise<void> {
  const { name, uri } = options;
  return task(
    `virsh destroy ${name}`,
    async (ctx) => {
      const state = await getDomainState(options);
      if (state !== 'running' && state !== 'paused' && state !== 'crashed' && state !== 'dying') {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `destroy ${$_(name)}`));
      }
      emitChanged({
        type: 'domain',
        resource: name,
        property: 'state',
        from: state,
        to: 'shutoff',
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/** Options for `setDomainAutostart()`. */
export interface SetDomainAutostartOptions extends DomainOptions {
  readonly autostart: boolean;
}

/**
 * **[IDEMPOTENT]** Enables or disables domain autostart.
 */
export async function setDomainAutostart(options: SetDomainAutostartOptions): Promise<void> {
  const { name, uri, autostart } = options;
  return task(
    `virsh autostart ${name}`,
    async (ctx) => {
      const info = await getDomainInfo(options);
      if (info.autostart === autostart) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `autostart ${autostart ? '' : '--disable '}${$_(name)}`));
      }
      emitChanged({
        type: 'domain',
        resource: name,
        property: 'autostart',
        from: String(info.autostart),
        to: String(autostart),
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/** Memory backend description for `snapshot-create-as --memspec`. */
export interface SnapshotMemspec {
  /** Memory state file (`file=`). */
  readonly file?: string;
  /** Snapshot kind (`snapshot=`). */
  readonly snapshot?: 'no' | 'internal' | 'external';
}

/**
 * Serializes a memspec to `[file=]name[,snapshot=type]` form.
 */
export function _snapshotMemspec(spec: SnapshotMemspec): string {
  const parts: string[] = [];
  if (spec.file !== undefined) {
    parts.push(`file=${spec.file}`);
  }
  if (spec.snapshot !== undefined) {
    parts.push(`snapshot=${spec.snapshot}`);
  }
  if (parts.length === 0) {
    throw new Error('snapshot memspec requires a file and/or snapshot kind');
  }
  return parts.join(',');
}

/** Per-disk backend description for `snapshot-create-as --diskspec`. */
export interface SnapshotDiskspec {
  /** Disk target name (`vda`, ...). */
  readonly disk: string;
  readonly snapshot?: 'no' | 'internal' | 'external';
  readonly driver?: string;
  readonly stype?: 'file' | 'block';
  readonly file?: string;
}

/**
 * Serializes a diskspec to `disk[,snapshot=][,driver=][,stype=][,file=]` form.
 */
export function _snapshotDiskspec(spec: SnapshotDiskspec): string {
  let s = spec.disk;
  if (spec.snapshot !== undefined) {
    s += `,snapshot=${spec.snapshot}`;
  }
  if (spec.driver !== undefined) {
    s += `,driver=${spec.driver}`;
  }
  if (spec.stype !== undefined) {
    s += `,stype=${spec.stype}`;
  }
  if (spec.file !== undefined) {
    s += `,file=${spec.file}`;
  }
  return s;
}

/** Options for `createSnapshot()`. */
export interface CreateSnapshotOptions extends DomainOptions {
  /** Snapshot name. When omitted, libvirt generates one. */
  readonly snapshot?: string;
  readonly description?: string;
  /** Disk-only snapshot without VM state (`--disk-only`). */
  readonly diskOnly?: boolean;
  /** Quiesce guest filesystems (`--quiesce`, requires `diskOnly`). */
  readonly quiesce?: boolean;
  /** All-or-nothing snapshot (`--atomic`). */
  readonly atomic?: boolean;
  /** Memory backend (`--memspec`, incompatible with `diskOnly`). */
  readonly memspec?: SnapshotMemspec;
  /** Per-disk backends (repeatable `--diskspec`). */
  readonly diskspecs?: readonly SnapshotDiskspec[];
}

/**
 * **[IDEMPOTENT]** Creates a domain snapshot. Returns true when created.
 *
 * Does nothing when a snapshot with the same name already exists (snapshots
 * are immutable, so existence implies identity).
 */
export async function createSnapshot(options: CreateSnapshotOptions): Promise<boolean> {
  const { name, uri, snapshot, description, diskOnly, quiesce, atomic, memspec, diskspecs } =
    options;
  return task(
    `virsh snapshot-create-as ${name}`,
    async (ctx) => {
      if (quiesce === true && diskOnly !== true) {
        throw new Error('snapshot quiesce requires diskOnly');
      }
      if (memspec !== undefined && diskOnly === true) {
        throw new Error('snapshot memspec cannot be combined with diskOnly');
      }
      if (snapshot !== undefined && (await snapshotExists({ name, uri, snapshot }))) {
        return false;
      }
      let cmd = `snapshot-create-as ${$_(name)}`;
      if (snapshot !== undefined) {
        cmd += ` ${$_(snapshot)}`;
      }
      if (description !== undefined) {
        cmd += ` ${$_(description)}`;
      }
      if (diskOnly === true) {
        cmd += ' --disk-only';
      }
      if (quiesce === true) {
        cmd += ' --quiesce';
      }
      if (atomic === true) {
        cmd += ' --atomic';
      }
      if (memspec !== undefined) {
        cmd += ` --memspec ${$_(_snapshotMemspec(memspec))}`;
      }
      for (const spec of diskspecs ?? []) {
        cmd += ` --diskspec ${$_(_snapshotDiskspec(spec))}`;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, cmd));
      }
      emitChanged({
        type: 'snapshot',
        resource: name,
        property: 'state',
        to: snapshot ?? 'created',
      });
      return true;
    },
    { details: () => ({ uri, snapshot }), verbosity: VERBOSITY_TRACE },
  );
}

/** Options for `revertSnapshot()`. */
export interface RevertSnapshotOptions extends DomainOptions {
  /**
   * Snapshot name. When omitted, reverts to the current snapshot
   * (`--current`).
   */
  readonly snapshot?: string;
  /** Boot or pause the domain after revert (`--running` / `--paused`). */
  readonly running?: 'running' | 'paused';
  /** Revert even when risky (`--force`). */
  readonly force?: boolean;
  /**
   * Reset UEFI nvram to the snapshot state (`--reset-nvram`). Needed when
   * reverting UEFI guests whose firmware variables changed since the
   * snapshot; without it the revert can fail or boot with stale variables.
   */
  readonly resetNvram?: boolean;
}

/**
 * Reverts a domain to a snapshot. This is destructive (changes since the
 * snapshot are lost) and always acts, like `restartService()`.
 */
export async function revertSnapshot(options: RevertSnapshotOptions): Promise<void> {
  const { name, uri, snapshot, running, force, resetNvram } = options;
  return task(
    `virsh snapshot-revert ${name}`,
    async (ctx) => {
      let cmd = `snapshot-revert ${$_(name)} ${snapshot === undefined ? '--current' : $_(snapshot)}`;
      if (running !== undefined) {
        cmd += ` --${running}`;
      }
      if (force === true) {
        cmd += ' --force';
      }
      if (resetNvram === true) {
        cmd += ' --reset-nvram';
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, cmd));
      }
      emitChanged({
        type: 'snapshot',
        resource: name,
        property: 'revert',
        to: snapshot ?? 'current',
      });
    },
    { details: () => ({ uri, snapshot }), verbosity: VERBOSITY_TRACE },
  );
}

/** A snapshot entry from `virsh snapshot-list`. */
export interface SnapshotListEntry {
  readonly name: string;
  /** Creation time as reported by virsh (raw string, never parsed). */
  readonly creationTime: string;
  readonly state: string;
}

/**
 * Parses `virsh snapshot-list` table output.
 *
 * The creation timestamp contains spaces, so the name (first column) and
 * state (last column) anchor the parse and everything between is kept
 * verbatim as `creationTime`.
 */
export function parseSnapshotList(output: string): SnapshotListEntry[] {
  return _parseListTable(output)
    .filter((cols) => cols.length >= 3)
    .map((cols) => ({
      name: cols[0],
      creationTime: cols.slice(1, -1).join(' '),
      state: cols[cols.length - 1],
    }));
}

/** Lists snapshots of a domain via `virsh snapshot-list`. */
export async function listSnapshots(options: DomainOptions): Promise<SnapshotListEntry[]> {
  const { name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `snapshot-list ${$_(name)}`));
  return parseSnapshotList(stdout);
}

/** Checks whether a named snapshot exists. */
export async function snapshotExists(
  options: DomainOptions & { readonly snapshot: string },
): Promise<boolean> {
  const { name, uri, snapshot } = options;
  const snapshots = await listSnapshots({ name, uri });
  return snapshots.some((s) => s.name === snapshot);
}

/** Media actions modeled by `changeDomainMedia` (mirrors `virsh change-media`). */
export type DomainMediaAction = 'eject' | 'insert' | 'update';

/** Options for `changeDomainMedia()`. */
export interface ChangeDomainMediaOptions extends DomainOptions {
  /** Guest target device name (e.g. `sda`). Must be a `cdrom` drive in the model. */
  readonly target: string;
  readonly action: DomainMediaAction;
  /**
   * Media source for `insert`/`update` (virsh requires it; `eject` forbids
   * it and throws when set).
   */
  readonly source?: string;
  /** Apply to the live domain (`--live`). Default: true. */
  readonly live?: boolean;
  /** Persist to the inactive config (`--config`). Default: true. */
  readonly config?: boolean;
  /** Force the change (`--force`). */
  readonly force?: boolean;
}

/**
 * **[IDEMPOTENT]** Changes cdrom media (`virsh change-media`). Returns true
 * when media was changed.
 *
 * Floppy drives are outside the normalized model (like PCI passthrough and
 * TPM); manage those through the raw XML path. No-op when the drive already
 * holds the desired state (ejected, or the same source); throws when no
 * cdrom with `target` exists.
 */
export async function changeDomainMedia(options: ChangeDomainMediaOptions): Promise<boolean> {
  const { name, uri, target, action, source, live, config, force } = options;
  return task(
    `virsh change-media ${name}`,
    async (ctx) => {
      if (action === 'eject' && source !== undefined) {
        throw new Error('change-media eject forbids a source');
      }
      if (action !== 'eject' && source === undefined) {
        throw new Error(`change-media ${action} requires a source`);
      }
      const conf = await getDomain(options);
      const drive = (conf.disks ?? []).find(
        (d) => d.target === target && (d.device ?? 'disk') === 'cdrom',
      );
      if (drive === undefined) {
        throw new Error(`domain '${name}' has no cdrom drive '${target}'`);
      }
      if (action === 'eject' && drive.source === '') {
        return false;
      }
      if (action !== 'eject' && drive.source === source) {
        return false;
      }
      let cmd = `change-media ${$_(name)} ${$_(target)} --${action}`;
      if (action !== 'eject') {
        cmd += ` ${$_(source as string)}`;
      }
      if ((live ?? true) === true) {
        cmd += ' --live';
      }
      if ((config ?? true) === true) {
        cmd += ' --config';
      }
      if (force === true) {
        cmd += ' --force';
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, cmd));
      }
      emitChanged({
        type: 'domain',
        resource: name,
        property: `cdrom:${target}`,
        from: drive.source === '' ? undefined : drive.source,
        to: action === 'eject' ? 'ejected' : (source as string),
      });
      return true;
    },
    { details: () => ({ uri, target }), verbosity: VERBOSITY_TRACE },
  );
}

/** A guest interface address entry from `virsh domifaddr`. */
export interface DomIfAddrEntry {
  readonly interface: string;
  readonly mac: string;
  readonly protocol: string;
  /** CIDR address, undefined when shown as `-`. */
  readonly address: string | undefined;
}

/**
 * Parses `virsh domifaddr` table output (any `--source`, including `--full`
 * repeat rows).
 */
export function parseDomIfAddr(output: string): DomIfAddrEntry[] {
  return _parseListTable(output)
    .filter((cols) => cols.length >= 4)
    .map((cols) => ({
      interface: cols[0],
      mac: cols[1],
      protocol: cols[2],
      address: cols[3] === '-' ? undefined : cols[3],
    }));
}

/** Options for `getDomIfAddr()`. */
export interface DomIfAddrOptions extends DomainOptions {
  /** Limit output to one interface. */
  readonly interface?: string;
  /** Address source. Defaults to the virsh default (`lease`). */
  readonly source?: 'lease' | 'agent' | 'arp';
  /** Always show interface name and MAC (`--full`). */
  readonly full?: boolean;
}

/** Returns guest interface addresses via `virsh domifaddr`. */
export async function getDomIfAddr(options: DomIfAddrOptions): Promise<DomIfAddrEntry[]> {
  const { name, uri } = options;
  let cmd = `domifaddr ${$_(name)}`;
  if (options.interface !== undefined) {
    cmd += ` ${$_(options.interface)}`;
  }
  if (options.full === true) {
    cmd += ' --full';
  }
  if (options.source !== undefined) {
    cmd += ` --source ${options.source}`;
  }
  const { stdout } = await sh(_virsh(uri, cmd));
  return parseDomIfAddr(stdout);
}
