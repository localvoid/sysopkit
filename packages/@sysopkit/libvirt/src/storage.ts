/**
 * @module storage
 *
 * Libvirt storage pool and volume management with a normalized TypeScript
 * API.
 *
 * Define pools with `PoolConf` and volumes with `VolumeConf` instead of
 * hand-writing XML; `virsh` remains the transport and `Bun.XML` (via the
 * internal `./xml.js` helpers) handles XML, so this module only runs on the
 * Bun runtime.
 *
 * Only `dir` pools are modeled in this version; other pool types can still
 * be managed through the raw XML path of `definePool()` (`{ name, xml }`),
 * which defines by existence and only redefines with `update: true`.
 *
 * @see virsh(1) - management user interface for libvirt guests and hypervisor
 */

import { emitChanged, task, VERBOSITY_TRACE } from 'sysopkit';
import { getPathInfo } from 'sysopkit/op/file';
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
  childElement,
  childText,
  isXmlElement,
  parseXmlDocument,
  stringifyXmlDocument,
  xmlAttr,
  xmlText,
  type MutableXmlElement,
  type XmlDocument,
} from './xml.js';

/**
 * Normalized storage pool configuration.
 *
 * Only the modeled subset participates in idempotency checks: fields left
 * undefined act as wildcards when comparing against `virsh pool-dumpxml`
 * output (see `poolConfigMatches`).
 */
export interface PoolConf {
  /** Pool name. */
  readonly name: string;
  /** Pool type. Only `dir` is modeled. Default: `dir`. */
  readonly type?: 'dir';
  /** Target directory (`<target><path>`). */
  readonly path: string;
}

/**
 * Serializes a normalized pool configuration to libvirt pool XML.
 */
export function serializePoolXml(pool: PoolConf): string {
  if (pool.name === '') {
    throw new Error('pool name must not be empty');
  }
  if (pool.path === '') {
    throw new Error(`pool '${pool.name}' requires a target path`);
  }
  const kind: string = pool.type ?? 'dir';
  if (kind !== 'dir') {
    throw new Error(`unsupported pool type '${kind}'`);
  }
  const doc: XmlDocument = {
    pool: {
      '@type': 'dir',
      'name': pool.name,
      'target': { path: pool.path },
    },
  };
  return stringifyXmlDocument(doc);
}

/**
 * Parses libvirt pool XML (e.g. `virsh pool-dumpxml` output) into the
 * normalized model.
 *
 * Throws on pool types other than `dir` (manage those through the raw XML
 * path of `definePool()`).
 */
export function parsePoolXml(xml: string): PoolConf {
  const doc = parseXmlDocument(xml);
  const root = doc['pool'];
  if (!isXmlElement(root)) {
    throw new Error('invalid pool XML: missing <pool> root');
  }
  const name = childText(root, 'name');
  if (name === undefined) {
    throw new Error('invalid pool XML: missing <name>');
  }
  const type = xmlAttr(root, 'type') ?? 'dir';
  if (type !== 'dir') {
    throw new Error(
      `pool type '${type}' is outside the normalized model (use the raw XML path of definePool)`,
    );
  }
  const targetEl = childElement(root, 'target');
  const path = isXmlElement(targetEl) ? childText(targetEl, 'path') : undefined;
  if (path === undefined) {
    throw new Error('invalid pool XML: missing <target><path>');
  }
  return { name, path };
}

/**
 * Compares live configuration against desired configuration.
 *
 * Fields left undefined in `desired` act as wildcards.
 */
export function poolConfigMatches(current: PoolConf, desired: PoolConf): boolean {
  if (current.name !== desired.name) {
    return false;
  }
  if ((desired.type ?? 'dir') !== (current.type ?? 'dir')) {
    return false;
  }
  return current.path === desired.path;
}

/** Volume image formats modeled by `VolumeConf`. */
export type VolumeFormat = 'qcow2' | 'raw';

/**
 * Normalized storage volume configuration.
 */
export interface VolumeConf {
  /** Volume name (e.g. `guest.qcow2`). */
  readonly name: string;
  /** Capacity in MiB. */
  readonly capacityMiB: number;
  /** Image format. Default: `qcow2`. */
  readonly format?: VolumeFormat;
  /** Backing store image path (for overlays / linked clones). */
  readonly backingPath?: string;
  /** Backing store format. Defaults to the volume format. */
  readonly backingFormat?: VolumeFormat;
}

/**
 * Serializes a normalized volume configuration to libvirt volume XML
 * (for `virsh vol-create`).
 */
export function serializeVolumeXml(volume: VolumeConf): string {
  if (volume.name === '') {
    throw new Error('volume name must not be empty');
  }
  if (!Number.isFinite(volume.capacityMiB) || volume.capacityMiB <= 0) {
    throw new Error(`invalid capacityMiB '${volume.capacityMiB}'`);
  }
  const format = volume.format ?? 'qcow2';
  const target: MutableXmlElement = { format: { '@type': format } };
  const root: MutableXmlElement = {
    name: volume.name,
    capacity: { '@unit': 'MiB', '#text': String(volume.capacityMiB) },
    target,
  };
  if (volume.backingPath !== undefined) {
    root['backingStore'] = {
      path: volume.backingPath,
      format: { '@type': volume.backingFormat ?? format },
    };
  }
  const doc: XmlDocument = { volume: root };
  return stringifyXmlDocument(doc);
}

/** Volume details from `virsh vol-dumpxml`. */
export interface VolumeInfo {
  readonly name: string;
  readonly capacityMiB: number;
  readonly format: string | undefined;
  readonly path: string | undefined;
}

/**
 * Parses `virsh vol-dumpxml` output into volume details.
 */
export function parseVolumeInfo(xml: string): VolumeInfo {
  const doc = parseXmlDocument(xml);
  const root = doc['volume'];
  if (!isXmlElement(root)) {
    throw new Error('invalid volume XML: missing <volume> root');
  }
  const name = childText(root, 'name');
  if (name === undefined) {
    throw new Error('invalid volume XML: missing <name>');
  }
  const capacityEl = childElement(root, 'capacity');
  const capacityText = xmlText(capacityEl);
  const capacityMiB =
    capacityText === undefined
      ? Number.NaN
      : Math.round(
          _sizeToMiB(
            `${capacityText} ${isXmlElement(capacityEl) ? (xmlAttr(capacityEl, 'unit') ?? 'MiB') : 'MiB'}`,
          ),
        );
  if (!Number.isFinite(capacityMiB)) {
    throw new Error('invalid volume XML: missing <capacity>');
  }
  const targetEl = childElement(root, 'target');
  const formatEl = isXmlElement(targetEl) ? childElement(targetEl, 'format') : undefined;
  const path = isXmlElement(targetEl) ? childText(targetEl, 'path') : undefined;
  return {
    name,
    capacityMiB,
    format: isXmlElement(formatEl) ? xmlAttr(formatEl, 'type') : undefined,
    path,
  };
}

/** Options for pool operations that address a pool by name. */
export interface PoolOptions extends VirshOptions {
  readonly name: string;
}

/** A pool entry from `virsh pool-list --all`. */
export interface PoolListEntry {
  readonly name: string;
  readonly active: boolean;
  readonly autostart: boolean;
}

/** Parses `virsh pool-list --all` table output. */
export function parsePoolList(output: string): PoolListEntry[] {
  return _parseListTable(output)
    .filter((cols) => cols.length >= 3)
    .map((cols) => ({
      name: cols[0],
      active: cols[1] === 'active',
      autostart: cols[2] === 'yes',
    }));
}

/** Lists all pools (active and defined) via `virsh pool-list --all`. */
export async function listPools(options?: VirshOptions): Promise<PoolListEntry[]> {
  const { stdout } = await sh(_virsh(options?.uri, 'pool-list --all'));
  return parsePoolList(stdout);
}

/** Checks whether a pool is defined. */
export async function poolExists(options: PoolOptions): Promise<boolean> {
  const { name, uri } = options;
  return (await _tryVirshXml(_virsh(uri, `pool-dumpxml ${$_(name)}`))) !== undefined;
}

/** Returns the live XML of a pool. Throws when not defined. */
export async function getPoolXml(options: PoolOptions): Promise<string> {
  const { name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `pool-dumpxml ${$_(name)}`));
  return stdout;
}

/** Returns the normalized configuration of a defined pool. */
export async function getPool(options: PoolOptions): Promise<PoolConf> {
  return parsePoolXml(await getPoolXml(options));
}

/** Pool details from `virsh pool-info`. */
export interface PoolInfo {
  readonly name: string;
  readonly active: boolean;
  readonly autostart: boolean;
  readonly persistent: boolean;
}

/** Parses `virsh pool-info` output. */
export function parsePoolInfo(output: string): PoolInfo {
  const info = _parseInfoBlock(output);
  const name = info['Name'];
  if (name === undefined || name === '') {
    throw new Error('invalid pool-info output: missing Name');
  }
  return {
    name,
    active: info['State'] === 'running',
    autostart: info['Autostart'] === 'yes',
    persistent: info['Persistent'] === 'yes',
  };
}

/** Returns pool details from `virsh pool-info`. */
export async function getPoolInfo(options: PoolOptions): Promise<PoolInfo> {
  const { name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `pool-info ${$_(name)}`));
  return parsePoolInfo(stdout);
}

/** Options for `definePool()`: normalized config or raw XML. */
export type DefinePoolOptions = VirshOptions &
  (
    | { readonly pool: PoolConf }
    | {
        /** Raw pool XML for types outside the normalized model. */
        readonly xml: string;
        readonly name: string;
        /**
         * Redefine even when the pool already exists. Without this, an
         * existing pool is left untouched (raw XML is compared by
         * existence only, since libvirt reformats XML on define).
         */
        readonly update?: boolean;
      }
  );

/**
 * **[IDEMPOTENT]** Defines a pool from a normalized config or raw XML.
 *
 * The normalized path compares `virsh pool-dumpxml` output field-by-field
 * (unspecified fields are wildcards) and redefines only on drift. The raw
 * XML path defines by existence unless `update` is set.
 *
 * Note: defining does not build or start the pool; see `buildPool()` and
 * `startPool()`.
 */
export async function definePool(options: DefinePoolOptions): Promise<void> {
  if ('pool' in options) {
    const { pool, uri } = options;
    return task(
      `virsh pool-define ${pool.name}`,
      async (ctx) => {
        const current = await _tryVirshXml(_virsh(uri, `pool-dumpxml ${$_(pool.name)}`));
        if (current !== undefined && poolConfigMatches(parsePoolXml(current), pool)) {
          return;
        }
        const xml = serializePoolXml(pool);
        if (!ctx.dryRun) {
          await withTempFile(
            async (path) => {
              await sh(_virsh(uri, `pool-define ${$_(path)}`));
            },
            { content: xml, template: VIRSH_XML_TEMPLATE },
          );
        }
        emitChanged({
          type: 'pool',
          resource: pool.name,
          property: current === undefined ? 'defined' : 'redefined',
          to: 'true',
        });
      },
      { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
    );
  }

  const { name, xml, uri, update } = options;
  return task(
    `virsh pool-define ${name}`,
    async (ctx) => {
      const current = await _tryVirshXml(_virsh(uri, `pool-dumpxml ${$_(name)}`));
      if (current !== undefined && update !== true) {
        return;
      }
      if (!ctx.dryRun) {
        await withTempFile(
          async (path) => {
            await sh(_virsh(uri, `pool-define ${$_(path)}`));
          },
          { content: xml, template: VIRSH_XML_TEMPLATE },
        );
      }
      emitChanged({
        type: 'pool',
        resource: name,
        property: current === undefined ? 'defined' : 'redefined',
        to: 'true',
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Undefines a pool. Does nothing when not defined.
 *
 * The pool must be inactive first (`destroyPool()` stops an active one).
 */
export async function undefinePool(options: PoolOptions): Promise<void> {
  const { name, uri } = options;
  return task(
    `virsh pool-undefine ${name}`,
    async (ctx) => {
      const current = await _tryVirshXml(_virsh(uri, `pool-dumpxml ${$_(name)}`));
      if (current === undefined) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `pool-undefine ${$_(name)}`));
      }
      emitChanged({ type: 'pool', resource: name, property: 'state', to: 'undefined' });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Builds a pool backend (`virsh pool-build`).
 *
 * For `dir` pools this creates the target directory; the check reads the
 * target path from the pool XML, so already-built pools are a no-op.
 */
export async function buildPool(options: PoolOptions): Promise<boolean> {
  const { name, uri } = options;
  return task(
    `virsh pool-build ${name}`,
    async (ctx) => {
      const pool = await getPool(options);
      const info = await getPathInfo(pool.path);
      if (info !== undefined) {
        return false;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `pool-build ${$_(name)}`));
      }
      emitChanged({ type: 'pool', resource: name, property: 'state', to: 'built' });
      return true;
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Starts a pool. Returns true when it was started.
 */
export async function startPool(options: PoolOptions): Promise<boolean> {
  const { name, uri } = options;
  return task(
    `virsh pool-start ${name}`,
    async (ctx) => {
      const info = await getPoolInfo(options);
      if (info.active) {
        return false;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `pool-start ${$_(name)}`));
      }
      emitChanged({
        type: 'pool',
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
 * **[IDEMPOTENT]** Stops an active pool. Does nothing when inactive.
 */
export async function destroyPool(options: PoolOptions): Promise<void> {
  const { name, uri } = options;
  return task(
    `virsh pool-destroy ${name}`,
    async (ctx) => {
      const info = await getPoolInfo(options);
      if (!info.active) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `pool-destroy ${$_(name)}`));
      }
      emitChanged({
        type: 'pool',
        resource: name,
        property: 'state',
        from: 'active',
        to: 'inactive',
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/** Options for `setPoolAutostart()`. */
export interface SetPoolAutostartOptions extends PoolOptions {
  readonly autostart: boolean;
}

/**
 * **[IDEMPOTENT]** Enables or disables pool autostart.
 */
export async function setPoolAutostart(options: SetPoolAutostartOptions): Promise<void> {
  const { name, uri, autostart } = options;
  return task(
    `virsh pool-autostart ${name}`,
    async (ctx) => {
      const info = await getPoolInfo(options);
      if (info.autostart === autostart) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `pool-autostart ${autostart ? '' : '--disable '}${$_(name)}`));
      }
      emitChanged({
        type: 'pool',
        resource: name,
        property: 'autostart',
        from: String(info.autostart),
        to: String(autostart),
      });
    },
    { details: () => ({ uri }), verbosity: VERBOSITY_TRACE },
  );
}

/** Options for volume operations that address a volume by pool and name. */
export interface VolumeOptions extends VirshOptions {
  readonly pool: string;
  readonly name: string;
}

/** Parses `virsh vol-list --pool <pool>` table output into volume names. */
export function parseVolumeList(output: string): string[] {
  return _parseListTable(output)
    .filter((cols) => cols.length >= 1)
    .map((cols) => cols[0]);
}

/** Lists volume names in a pool via `virsh vol-list`. */
export async function listVolumes(
  options: VirshOptions & { readonly pool: string },
): Promise<string[]> {
  const { pool, uri } = options;
  const { stdout } = await sh(_virsh(uri, `vol-list --pool ${$_(pool)}`));
  return parseVolumeList(stdout);
}

/** Checks whether a volume exists in a pool. */
export async function volumeExists(options: VolumeOptions): Promise<boolean> {
  const { pool, name, uri } = options;
  return (
    (await _tryVirshXml(_virsh(uri, `vol-dumpxml ${$_(name)} --pool ${$_(pool)}`))) !== undefined
  );
}

/** Returns volume details from `virsh vol-dumpxml`. */
export async function getVolumeInfo(options: VolumeOptions): Promise<VolumeInfo> {
  const { pool, name, uri } = options;
  const { stdout } = await sh(_virsh(uri, `vol-dumpxml ${$_(name)} --pool ${$_(pool)}`));
  return parseVolumeInfo(stdout);
}

/** Options for `createVolume()`. */
export interface CreateVolumeOptions extends VirshOptions {
  readonly pool: string;
  readonly volume: VolumeConf;
}

/**
 * **[IDEMPOTENT]** Creates a volume in a pool.
 *
 * Does nothing when a volume with the same name, capacity, and format
 * already exists; throws when the existing volume differs (delete it
 * first, volumes cannot be resized in place through this API).
 */
export async function createVolume(options: CreateVolumeOptions): Promise<void> {
  const { pool, volume, uri } = options;
  return task(
    `virsh vol-create ${volume.name}`,
    async (ctx) => {
      const current = await _tryVirshXml(
        _virsh(uri, `vol-dumpxml ${$_(volume.name)} --pool ${$_(pool)}`),
      );
      if (current !== undefined) {
        const info = parseVolumeInfo(current);
        if (
          info.capacityMiB === volume.capacityMiB &&
          (info.format ?? 'qcow2') === (volume.format ?? 'qcow2')
        ) {
          return;
        }
        throw new Error(
          `volume '${volume.name}' already exists in pool '${pool}' with different capacity/format`,
        );
      }
      const xml = serializeVolumeXml(volume);
      if (!ctx.dryRun) {
        await withTempFile(
          async (path) => {
            await sh(_virsh(uri, `vol-create --pool ${$_(pool)} ${$_(path)}`));
          },
          { content: xml, template: VIRSH_XML_TEMPLATE },
        );
      }
      emitChanged({ type: 'volume', resource: volume.name, property: 'state', to: 'created' });
    },
    { details: () => ({ pool, uri }), verbosity: VERBOSITY_TRACE },
  );
}

/**
 * **[IDEMPOTENT]** Deletes a volume from a pool. Does nothing when absent.
 */
export async function deleteVolume(options: VolumeOptions): Promise<void> {
  const { pool, name, uri } = options;
  return task(
    `virsh vol-delete ${name}`,
    async (ctx) => {
      const current = await _tryVirshXml(_virsh(uri, `vol-dumpxml ${$_(name)} --pool ${$_(pool)}`));
      if (current === undefined) {
        return;
      }
      if (!ctx.dryRun) {
        await sh(_virsh(uri, `vol-delete ${$_(name)} --pool ${$_(pool)}`));
      }
      emitChanged({ type: 'volume', resource: name, property: 'state', to: 'deleted' });
    },
    { details: () => ({ pool, uri }), verbosity: VERBOSITY_TRACE },
  );
}
