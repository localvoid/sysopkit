/** Result of comparing two arrays, containing added and removed elements. */
export interface DiffArrayResult<T> {
  /** Elements present in the second array but not the first. */
  readonly added: T[];
  /** Elements present in the first array but not the second. */
  readonly removed: T[];
}

/**
 * Compares two sorted arrays and returns the differences.
 *
 * Uses the provided comparison function to determine element ordering and
 * equality. Returns null if arrays are equivalent.
 */
export function diffArrays<T>(
  a: T[],
  b: T[],
  compareFn: (a: T, b: T) => number,
): DiffArrayResult<T> | null {
  const added: T[] = [];
  const removed: T[] = [];
  const _a = a.toSorted(compareFn);
  const _b = b.toSorted(compareFn);
  let bi = 0;
  for (let ai = 0; ai < _a.length; ai++) {
    const an = _a[ai];
    if (bi < _b.length) {
      const bn = _b[bi];
      const d = compareFn(an, bn);
      if (d === 0) {
        bi++;
      } else if (d < 0) {
        removed.push(bn);
      } else {
        added.push(an);
        bi++;
      }
    }
  }
  if (added.length === 0 && removed.length === 0) {
    return null;
  }
  return { added, removed };
}
