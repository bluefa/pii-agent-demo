/**
 * Every hardcoded guide body must pass the same allow-list validator that
 * `GuideCardPure` runs at render time — an invalid entry would swap the
 * guide for the invalid-state card on the live page.
 */

import { describe, expect, it } from 'vitest';

import { STEP_GUIDE_HTML } from '@/lib/constants/step-guide-content';
import { GUIDE_NAMES } from '@/lib/types/guide';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

describe('STEP_GUIDE_HTML', () => {
  it.each(GUIDE_NAMES)('%s passes validateGuideHtml', (name) => {
    const result = validateGuideHtml(STEP_GUIDE_HTML[name]);
    expect(result).toMatchObject({ valid: true });
  });
});
