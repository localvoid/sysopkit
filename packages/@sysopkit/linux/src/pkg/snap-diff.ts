/**
 * @module pkg/snap-diff
 *
 * Generic snapshot-diff helpers for name/version package managers
 * (APT, APK, pacman).
 *
 * Real (non-dry-run) transactions are detected by diffing installed-package
 * snapshots taken before and after the package manager runs instead of
 * parsing its human-readable output. Dry-run previews compare requested
 * names against the snapshot without invoking the solver. Only
 * whitespace-delimited or otherwise caller-controlled formats are ever
 * parsed — never human-readable transaction tables or progress lines.
 *
 * Epoch/installonly semantics (DNF4/DNF5) live in `./dnf-common.js`; this
 * module covers managers with a single version string per name (+optional
 * arch) and no parallel-installable packages.
 */

/** Minimal installed-package view for name/version snapshot diffing. */
export interface NameVersionInfo {
  readonly name: string;
  readonly version: string;
  /** Present when the manager reports it (e.g. APT multiarch). */
  readonly arch?: string;
}

/** Changed package names grouped by change kind. */
export interface VersionChanges {
  /** Packages whose version was replaced in place. */
  readonly updated: string[];
  /** Newly installed packages. */
  readonly installed: string[];
  /** Packages removed by the transaction. */
  readonly removed: string[];
}

/** Requested package names split by presence in a snapshot. */
export interface PresenceSplit {
  /** Requested names found in the snapshot. */
  readonly present: string[];
  /** Requested names absent from the snapshot. */
  readonly absent: string[];
}

/**
 * Splits requested package names by exact-name presence in a snapshot.
 *
 * Used for install/remove dry-run previews: no solver run, no output
 * parsing. Results are de-duplicated and sorted for determinism.
 */
export function splitByPresence(
  snapshot: readonly { readonly name: string }[],
  requested: readonly string[],
): PresenceSplit {
  const installed = new Set(snapshot.map((p) => p.name));
  const present = new Set<string>();
  const absent = new Set<string>();
  for (const name of requested) {
    if (installed.has(name)) {
      present.add(name);
    } else {
      absent.add(name);
    }
  }
  return { present: [...present].sort(), absent: [...absent].sort() };
}

/**
 * Maps upgrade-candidate names onto change groups using installed names.
 *
 * Used for upgrade dry-run previews where candidates come from a manager
 * listing (e.g. `apt list --upgradable`, `pacman -Qu`) rather than a
 * version comparison: a candidate that is installed was replaced in place
 * (`updated`); one that is not is new (`installed`). An optional scope
 * restricts the result to requested names (full previews pass none).
 * Removals need the solver transaction and are never predicted.
 * Results are de-duplicated and sorted for determinism.
 */
export function splitListedUpgrades(
  candidates: readonly string[],
  installedNames: ReadonlySet<string>,
  scope?: readonly string[],
): VersionChanges {
  const wanted = scope === void 0 ? void 0 : new Set(scope);
  const updated = new Set<string>();
  const installed = new Set<string>();
  for (const name of candidates) {
    if (wanted !== void 0 && !wanted.has(name)) {
      continue;
    }
    if (installedNames.has(name)) {
      updated.add(name);
    } else {
      installed.add(name);
    }
  }
  return {
    updated: [...updated].sort(),
    installed: [...installed].sort(),
    removed: [],
  };
}

interface VersionSlot {
  readonly name: string;
  before: string | undefined;
  after: string | undefined;
}

/**
 * Diffs two name/version snapshots, grouping changed names by change kind.
 *
 * Entries are keyed by name+arch (arch groups together when the manager
 * does not report it), so multiarch variants are tracked independently
 * while the reported resource stays the bare name. A version change in
 * place lands in `updated`; a name+arch seen only after lands in
 * `installed`; one seen only before lands in `removed`. Results are
 * de-duplicated and sorted for determinism.
 */
export function diffVersionSnapshots(
  before: readonly NameVersionInfo[],
  after: readonly NameVersionInfo[],
): VersionChanges {
  const groups = new Map<string, Map<string, VersionSlot>>();
  const track = (p: NameVersionInfo, side: 'before' | 'after'): void => {
    const arch = p.arch ?? '';
    let byArch = groups.get(p.name);
    if (byArch === void 0) {
      byArch = new Map();
      groups.set(p.name, byArch);
    }
    let slot = byArch.get(arch);
    if (slot === void 0) {
      slot = { name: p.name, before: void 0, after: void 0 };
      byArch.set(arch, slot);
    }
    slot[side] = p.version;
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
    for (const slot of byArch.values()) {
      if (slot.after === void 0) {
        removed.add(slot.name);
      } else if (slot.before === void 0) {
        installed.add(slot.name);
      } else if (slot.after !== slot.before) {
        updated.add(slot.name);
      }
    }
  }
  return {
    updated: [...updated].sort(),
    installed: [...installed].sort(),
    removed: [...removed].sort(),
  };
}
