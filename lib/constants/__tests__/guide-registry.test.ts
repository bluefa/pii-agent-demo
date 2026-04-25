import { describe, expect, it } from 'vitest';
import {
  GUIDE_NAMES,
  GUIDE_SLOTS,
  findSlotsForGuide,
  resolveSlot,
  type GuideName,
} from '@/lib/constants/guide-registry';

describe('guide-registry', () => {
  it('GUIDE_NAMES has exactly 22 entries', () => {
    expect(GUIDE_NAMES).toHaveLength(22);
  });

  it('every GUIDE_SLOTS entry references a name in GUIDE_NAMES', () => {
    const names = new Set<string>(GUIDE_NAMES);
    for (const slot of Object.values(GUIDE_SLOTS)) {
      expect(names.has(slot.guideName)).toBe(true);
    }
  });

  it('resolveSlot returns the correct slot for a process-step key', () => {
    const slot = resolveSlot('process.aws.auto.3');
    expect(slot.guideName).toBe('AWS_APPLYING');
    expect(slot.component).toBe('GuideCard');
    expect(slot.placement).toEqual({
      kind: 'process-step',
      provider: 'AWS',
      variant: 'AUTO',
      step: 3,
      stepLabel: '연동 대상 반영 중',
    });
  });

  it('findSlotsForGuide returns 2 slots for AWS_TARGET_CONFIRM (auto + manual)', () => {
    const slots = findSlotsForGuide('AWS_TARGET_CONFIRM');
    expect(slots).toHaveLength(2);
    const variants = slots.map((slot) => {
      expect(slot.placement.kind).toBe('process-step');
      return slot.placement.kind === 'process-step' ? slot.placement.variant : undefined;
    });
    expect(variants.sort()).toEqual(['AUTO', 'MANUAL']);
  });

  it('findSlotsForGuide returns 1 slot for AWS_AUTO_INSTALLING (auto-only fork)', () => {
    const slots = findSlotsForGuide('AWS_AUTO_INSTALLING');
    expect(slots).toHaveLength(1);
    expect(slots[0].placement.kind).toBe('process-step');
    if (slots[0].placement.kind === 'process-step') {
      expect(slots[0].placement.variant).toBe('AUTO');
      expect(slots[0].placement.step).toBe(4);
    }
  });

  it('findSlotsForGuide returns 0 slots for an orphan name (type-cast)', () => {
    const orphan = 'NONEXISTENT_GUIDE' as GuideName;
    expect(findSlotsForGuide(orphan)).toHaveLength(0);
  });
});
