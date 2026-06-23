import { describe, expect, it } from 'vitest';
import { deriveLogicalDbCounts, stableHash } from '@/lib/logical-db-counts';

describe('stableHash', () => {
  it('is deterministic for a given key', () => {
    expect(stableHash('res-1')).toBe(stableHash('res-1'));
    expect(stableHash('conf-x')).toBe(stableHash('conf-x'));
  });

  it('returns a non-negative integer', () => {
    expect(stableHash('res-1')).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(stableHash('res-1'))).toBe(true);
  });
});

describe('deriveLogicalDbCounts', () => {
  it('returns a stable [target, excluded] pair for the same resourceId', () => {
    expect(deriveLogicalDbCounts('res-1')).toEqual(deriveLogicalDbCounts('res-1'));
    expect(deriveLogicalDbCounts('conf-x')).toEqual(deriveLogicalDbCounts('conf-x'));
  });

  it('returns one of the known demo pairs', () => {
    const pairs = [
      [12, 3],
      [8, 1],
      [5, 2],
      [10, 2],
      [6, 1],
    ];
    expect(pairs).toContainEqual([...deriveLogicalDbCounts('res-1')]);
    expect(pairs).toContainEqual([...deriveLogicalDbCounts('another-resource-id')]);
  });
});
