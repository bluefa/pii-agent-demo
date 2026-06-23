/**
 * Demo-derived logical-DB counts (연동 대상 / 연동 제외) per resource.
 *
 * The BFF contract does not yet carry per-resource logical-DB counts, so derive a
 * stable [target, excluded] pair from the resourceId. The values are deterministic
 * per resourceId. Replace this helper once the schema exposes the real counts.
 *
 * `stableHash` is exported because the same deterministic hash is reused by
 * sibling demo helpers (e.g. unhealthy-row / integration-progress pickers) so the
 * displayed mix stays stable across renders.
 */

const LOGICAL_DB_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [12, 3],
  [8, 1],
  [5, 2],
  [10, 2],
  [6, 1],
];

export const stableHash = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const deriveLogicalDbCounts = (resourceId: string): readonly [number, number] =>
  LOGICAL_DB_PAIRS[stableHash(resourceId) % LOGICAL_DB_PAIRS.length];
