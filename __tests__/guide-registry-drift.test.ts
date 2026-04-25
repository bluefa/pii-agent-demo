/**
 * Drift CI — Guide CMS (spec §8.2).
 *
 * Asserts the registry (frontend constants) and the mock seed stay in
 * sync. If a `GuideName` is added to GUIDE_NAMES without a seed entry,
 * or a seed entry references a name not in GUIDE_NAMES, this test
 * fails and forces an explicit reconciliation in the same PR.
 */

import { describe, expect, it } from 'vitest';

import { GUIDE_NAMES, GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { guidesSeed } from '@/lib/bff/mock/guides-seed';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

describe('Guide registry ↔ seed drift', () => {
  it('seed keys === GUIDE_NAMES', () => {
    expect(new Set(Object.keys(guidesSeed))).toEqual(new Set(GUIDE_NAMES));
  });

  it('every GUIDE_SLOTS[*].guideName ⊂ GUIDE_NAMES', () => {
    const names = new Set<string>(GUIDE_NAMES);
    for (const slot of Object.values(GUIDE_SLOTS)) {
      expect(names.has(slot.guideName)).toBe(true);
    }
  });

  it('every name in GUIDE_NAMES is referenced by ≥1 slot', () => {
    const referenced = new Set<string>(
      Object.values(GUIDE_SLOTS).map((s) => s.guideName),
    );
    for (const name of GUIDE_NAMES) {
      expect(referenced.has(name)).toBe(true);
    }
  });

  it('every seed entry ko passes validateGuideHtml (en may be empty)', () => {
    for (const name of GUIDE_NAMES) {
      const entry = guidesSeed[name];
      expect(entry, `seed missing for ${name}`).toBeDefined();
      const result = validateGuideHtml(entry.contents.ko);
      expect(
        result.valid,
        `seed ko for ${name} failed validateGuideHtml: ${
          result.valid ? '' : JSON.stringify(result.errors)
        }`,
      ).toBe(true);
    }
  });
});
