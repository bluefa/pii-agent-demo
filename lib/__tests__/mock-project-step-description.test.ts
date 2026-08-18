import { describe, expect, it } from 'vitest';
import { mockProjects } from '@/lib/mock-data';

/**
 * Fixture descriptions open with "Step N." so the detail page's 설명 block names
 * the screen the fixture serves. N is only useful while it agrees with the
 * fixture's processStatus — and the azure/gcp clones inherit their base's
 * description unless told otherwise, which is exactly how N goes stale.
 */
describe('mock project step descriptions', () => {
  it('labels the step the fixture actually sits on', () => {
    const mismatched = mockProjects
      .map((p) => ({ p, m: /^Step (\d)\./.exec(p.description) }))
      .filter(({ p, m }) => m && Number(m[1]) !== p.processStatus)
      .map(({ p }) => `${p.targetSourceId} ${p.description.slice(0, 8)} != ${p.processStatus}`);

    expect(mismatched).toEqual([]);
  });
});
