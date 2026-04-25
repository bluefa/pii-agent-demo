/**
 * Guide resolver — spec §8.1 6-case suite.
 *
 * Complements `guide-registry.test.ts` (W1-a) by exercising the
 * resolver against each case enumerated in spec §8.1.
 */

import { describe, expect, it } from 'vitest';

import {
  GUIDE_SLOTS,
  findSlotsForGuide,
  resolveSlot,
  type GuideName,
  type GuideSlotKey,
} from '@/lib/constants/guide-registry';

describe('Guide resolver — spec §8.1', () => {
  it('case 1: resolveSlot returns the correct slot for a process-step key', () => {
    const slot = resolveSlot('process.aws.auto.3');
    expect(slot.guideName).toBe('AWS_APPLYING');
    expect(slot.placement.kind).toBe('process-step');
    if (slot.placement.kind === 'process-step') {
      expect(slot.placement.provider).toBe('AWS');
      expect(slot.placement.step).toBe(3);
      expect(slot.placement.variant).toBe('AUTO');
    }
  });

  it('case 2: AUTO and MANUAL share guideName at step 1 (AWS_TARGET_CONFIRM)', () => {
    const auto = resolveSlot('process.aws.auto.1');
    const manual = resolveSlot('process.aws.manual.1');
    expect(auto.guideName).toBe('AWS_TARGET_CONFIRM');
    expect(manual.guideName).toBe('AWS_TARGET_CONFIRM');
  });

  it('case 3: invalid key returns undefined at runtime', () => {
    // Cast through unknown — runtime input may be untyped (e.g. URL params).
    const slot = resolveSlot('process.invalid.key' as unknown as GuideSlotKey);
    expect(slot).toBeUndefined();
  });

  it('case 4: GUIDE_SLOTS has 28 unique keys', () => {
    const keys = Object.keys(GUIDE_SLOTS);
    expect(keys).toHaveLength(28);
    expect(new Set(keys).size).toBe(28);
  });

  it('case 5: every current slot is process-step kind', () => {
    for (const slot of Object.values(GUIDE_SLOTS)) {
      expect(slot.placement.kind).toBe('process-step');
    }
  });

  it('case 6: findSlotsForGuide returns shared (N=2), forked (N=1), orphan (N=0)', () => {
    expect(findSlotsForGuide('AWS_TARGET_CONFIRM')).toHaveLength(2);
    expect(findSlotsForGuide('AWS_AUTO_INSTALLING')).toHaveLength(1);
    expect(findSlotsForGuide('NOT_A_GUIDE_NAME' as GuideName)).toHaveLength(0);
  });
});
