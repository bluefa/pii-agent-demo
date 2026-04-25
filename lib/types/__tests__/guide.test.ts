import { describe, expect, it } from 'vitest';
import type { GuidePlacement } from '@/lib/types/guide';

describe('GuidePlacement', () => {
  it('narrows correctly via kind discriminator', () => {
    const placement: GuidePlacement = {
      kind: 'process-step',
      provider: 'AWS',
      variant: 'AUTO',
      step: 1,
      stepLabel: '연동 대상 확정',
    };

    if (placement.kind === 'process-step') {
      expect(placement.provider).toBe('AWS');
      expect(placement.step).toBe(1);
      expect(placement.stepLabel).toBe('연동 대상 확정');
    } else {
      throw new Error('expected process-step narrowing to succeed');
    }
  });

  it('narrows tooltip variant independently', () => {
    const placement: GuidePlacement = {
      kind: 'tooltip',
      surface: 'process-status',
      field: 'step.4',
    };

    if (placement.kind === 'tooltip') {
      expect(placement.surface).toBe('process-status');
      expect(placement.field).toBe('step.4');
    } else {
      throw new Error('expected tooltip narrowing to succeed');
    }
  });
});
