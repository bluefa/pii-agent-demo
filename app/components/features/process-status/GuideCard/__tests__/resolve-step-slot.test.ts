/**
 * Tests for `resolveStepSlot` (W4-a §Step 6).
 *
 * The resolver is the legacy facade's only branching logic: it must
 * produce a slot key that exists in `GUIDE_SLOTS` for every supported
 * `(provider, step, mode)` combination and `null` for out-of-range
 * steps. If either contract drifts, `GuideCard.tsx` would fall through
 * to a `null` render and break every provider page — so the mapping is
 * asserted exhaustively here.
 */

import { describe, expect, it } from 'vitest';

import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { ProcessStatus } from '@/lib/types';

describe('resolveStepSlot — AWS', () => {
  it('maps MANUAL mode to manual variant slot keys for all 7 steps', () => {
    for (let step = 1; step <= 7; step++) {
      const key = resolveStepSlot('AWS', step as ProcessStatus, 'MANUAL');
      expect(key).toBe(`process.aws.manual.${step}`);
      expect(key && GUIDE_SLOTS[key]).toBeDefined();
    }
  });

  it('maps AUTO mode to auto variant slot keys for all 7 steps', () => {
    for (let step = 1; step <= 7; step++) {
      const key = resolveStepSlot('AWS', step as ProcessStatus, 'AUTO');
      expect(key).toBe(`process.aws.auto.${step}`);
      expect(key && GUIDE_SLOTS[key]).toBeDefined();
    }
  });

  it('defaults to AUTO variant when installationMode is undefined', () => {
    expect(resolveStepSlot('AWS', ProcessStatus.WAITING_APPROVAL)).toBe('process.aws.auto.2');
  });
});

describe('resolveStepSlot — Azure / GCP', () => {
  it('maps Azure to process.azure.{step}', () => {
    for (let step = 1; step <= 7; step++) {
      const key = resolveStepSlot('Azure', step as ProcessStatus);
      expect(key).toBe(`process.azure.${step}`);
      expect(key && GUIDE_SLOTS[key]).toBeDefined();
    }
  });

  it('maps GCP to process.gcp.{step}', () => {
    for (let step = 1; step <= 7; step++) {
      const key = resolveStepSlot('GCP', step as ProcessStatus);
      expect(key).toBe(`process.gcp.${step}`);
      expect(key && GUIDE_SLOTS[key]).toBeDefined();
    }
  });

  it('ignores installationMode for non-AWS providers', () => {
    expect(resolveStepSlot('Azure', ProcessStatus.INSTALLING, 'MANUAL')).toBe('process.azure.4');
    expect(resolveStepSlot('GCP', ProcessStatus.INSTALLING, 'AUTO')).toBe('process.gcp.4');
  });
});

describe('resolveStepSlot — out of range', () => {
  it('returns null for step 0', () => {
    expect(resolveStepSlot('AWS', 0 as ProcessStatus, 'AUTO')).toBeNull();
  });

  it('returns null for step 8', () => {
    expect(resolveStepSlot('AWS', 8 as ProcessStatus, 'AUTO')).toBeNull();
    expect(resolveStepSlot('Azure', 8 as ProcessStatus)).toBeNull();
    expect(resolveStepSlot('GCP', 8 as ProcessStatus)).toBeNull();
  });
});
