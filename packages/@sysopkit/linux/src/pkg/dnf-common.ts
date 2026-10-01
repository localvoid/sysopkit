/**
 * @module pkg/dnf-common
 *
 * Shared snapshot-diff helpers for DNF4/DNF5 package ops.
 *
 * Real (non-dry-run) transactions are detected by diffing RPM database
 * snapshots taken before and after `dnf` runs instead of parsing the
 * human-readable transaction tables (`Installed:` / `Installing:` / ...),
 * which vary between DNF4/DNF5, locales, terminal widths, and `-q`
 * verbosity. Dry-run previews use the same snapshots plus structured
 * `repoquery --queryformat` output (a format string we control, one record
 * per line), so no human-readable output is parsed anywhere.
 */

/** Detailed information about an installed package. */
export interface DnfPackageInfo {
  readonly name: string;
  readonly epoch: string;
  readonly version: string;
  readonly release: string;
  readonly arch: string;
}

/** Changed package names grouped by change kind. */
export interface DnfChanges {
  /** Packages upgraded/downgraded in place (same name+arch, EVR replaced). */
  readonly updated: string[];
  /**
   * Newly installed packages, including parallel-installable ones (e.g.
   * kernels) where the old EVR is retained alongside the new one.
   */
  readonly installed: string[];
  /** Packages removed by the transaction (e.g. obsoleted). */
  readonly removed: string[];
}

/**
 * Parses `rpm -qa --queryformat` output into package metadata.
 *
 * Accepts both `rpm -qa` epoch style (`(none)` for packages without an
 * epoch, normalized to `'0'`) and `dnf repoquery` style (numeric epoch).
 * Blank lines and malformed rows are skipped; empty output yields `[]`.
 */
export function parseInstalledPackages(stdout: string): DnfPackageInfo[] {
  if (stdout.trim().length === 0) {
    return [];
  }
  const packages: DnfPackageInfo[] = [];
  for (const line of stdout.trim().split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) {
      continue;
    }
    const [name, epoch, version, release, arch] = parts;
    if (!name || !version || !release || !arch) {
      continue;
    }
    packages.push({
      name,
      epoch: !epoch || epoch === '(none)' ? '0' : epoch,
      version,
      release,
      arch,
    });
  }
  return packages;
}

interface EvrSets {
  readonly name: string;
  readonly before: Set<string>;
  readonly after: Set<string>;
}

/**
 * Diffs two RPM database snapshots, grouping changed names by change kind.
 *
 * Packages are keyed by name+arch with a set of EVRs each, so multilib
 * (`i686` vs `x86_64`) is tracked per arch while the reported resource
 * stays the bare name (matching the per-op change events). When the same
 * name+arch key loses old EVRs and gains new ones the package was replaced
 * in place (`updated`); when old EVRs are retained alongside new ones the
 * package is parallel-installable (e.g. kernels) and lands in `installed`.
 * Results are de-duplicated and sorted for determinism.
 */
export function diffPackages(
  before: readonly DnfPackageInfo[],
  after: readonly DnfPackageInfo[],
): DnfChanges {
  const groups = new Map<string, Map<string, EvrSets>>();
  const track = (p: DnfPackageInfo, side: 'before' | 'after'): void => {
    let byArch = groups.get(p.name);
    if (byArch === void 0) {
      byArch = new Map();
      groups.set(p.name, byArch);
    }
    let entry = byArch.get(p.arch);
    if (entry === void 0) {
      entry = { name: p.name, before: new Set(), after: new Set() };
      byArch.set(p.arch, entry);
    }
    entry[side].add(`${p.epoch}:${p.version}-${p.release}`);
  };
  for (const p of before) {
    track(p, 'before');
  }
  for (const p of after) {
    track(p, 'after');
  }
  const updated = new Set<string>();
  const installed = new Set<string>();
  const removed = new Set<string>();
  for (const byArch of groups.values()) {
    for (const entry of byArch.values()) {
      let added = false;
      for (const evr of entry.after) {
        if (!entry.before.has(evr)) {
          added = true;
          break;
        }
      }
      let gone = false;
      for (const evr of entry.before) {
        if (!entry.after.has(evr)) {
          gone = true;
          break;
        }
      }
      if (added && gone) {
        updated.add(entry.name);
      } else if (added) {
        installed.add(entry.name);
      } else if (gone) {
        removed.add(entry.name);
      }
    }
  }
  return {
    updated: [...updated].sort(),
    installed: [...installed].sort(),
    removed: [...removed].sort(),
  };
}

export { splitByPresence, type PresenceSplit } from './snap-diff.js';

/**
 * Parses `dnf repoquery --installonly --queryformat '%{NAME}\n'` output
 * into installonly package names.
 *
 * One name per line; blank lines are skipped; empty output yields `[]`.
 */
export function parseInstallonlyNames(stdout: string): string[] {
  if (stdout.trim().length === 0) {
    return [];
  }
  const names: string[] = [];
  for (const line of stdout.trim().split('\n')) {
    const name = line.trim();
    if (name.length > 0) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Maps available-upgrade candidates onto change groups using a snapshot.
 *
 * Used for upgrade dry-run previews with `repoquery --upgrades`
 * candidates. A candidate whose name+arch is already installed was
 * replaced in place (`updated`), unless it is an installonly package
 * (e.g. kernels), which installs alongside the old EVR (`installed`,
 * matching the snapshot-diff rule). A candidate with no installed
 * name+arch is new (`installed`). Candidates whose EVR is already
 * installed are skipped. Removals (obsoletes) need the full solver
 * transaction and are never predicted: `removed` is always empty.
 */
export function splitUpgradeCandidates(
  snapshot: readonly DnfPackageInfo[],
  candidates: readonly DnfPackageInfo[],
  installonly: ReadonlySet<string>,
): DnfChanges {
  const installedEvrs = new Map<string, Set<string>>();
  for (const p of snapshot) {
    // Names and arches come from whitespace-split rows, so a joined key
    // is unambiguous.
    const key = `${p.name} ${p.arch}`;
    let evrs = installedEvrs.get(key);
    if (evrs === void 0) {
      evrs = new Set();
      installedEvrs.set(key, evrs);
    }
    evrs.add(`${p.epoch}:${p.version}-${p.release}`);
  }
  const updated = new Set<string>();
  const installed = new Set<string>();
  for (const c of candidates) {
    const evrs = installedEvrs.get(`${c.name} ${c.arch}`);
    if (evrs === void 0) {
      installed.add(c.name);
    } else if (!evrs.has(`${c.epoch}:${c.version}-${c.release}`)) {
      if (installonly.has(c.name)) {
        installed.add(c.name);
      } else {
        updated.add(c.name);
      }
    }
  }
  return {
    updated: [...updated].sort(),
    installed: [...installed].sort(),
    removed: [],
  };
}
