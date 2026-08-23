/**
 * Every hardcoded guide body must pass the same allow-list validator that
 * `GuideCardPure` runs at render time — an invalid entry would swap the
 * guide for the invalid-state card on the live page.
 */

import { describe, expect, it } from 'vitest';

import { GUIDE_SLOTS, resolveSlot } from '@/lib/constants/guide-registry';
import { STEP_GUIDE_HTML } from '@/lib/constants/step-guide-content';
import { GUIDE_NAMES } from '@/lib/types/guide';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';

describe('STEP_GUIDE_HTML', () => {
  it.each(GUIDE_NAMES)('%s passes validateGuideHtml', (name) => {
    const result = validateGuideHtml(STEP_GUIDE_HTML[name]);
    expect(result).toMatchObject({ valid: true });
  });
});

/**
 * The owner's Figma has ONE step-3 card for every integration type, so the copy is
 * only correct if it actually reaches all of them. Derived from the registry rather
 * than a hand-written list: a new provider's step 3 joins this test by existing.
 */
describe('step 3 — the owner copy reaches every CSP', () => {
  const step3Keys = (Object.keys(GUIDE_SLOTS) as GuideSlotKey[]).filter((key) =>
    key.endsWith('.3'),
  );

  it('covers AWS (both variants), Azure, GCP and IDC', () => {
    expect(step3Keys.sort()).toEqual([
      'process.aws.auto.3',
      'process.aws.manual.3',
      'process.azure.3',
      'process.gcp.3',
      'process.idc.3',
    ]);
  });

  it.each(step3Keys)('%s renders the Figma copy', (key) => {
    const html = STEP_GUIDE_HTML[resolveSlot(key).guideName];
    expect(html).toContain('담당자가 연동을 위한 환경을 구성하고 있어요');
    expect(html).toContain('환경 구성이 완료되면 다음 단계로 넘어갑니다.');
    expect(html).toContain('이전에 설치된 PII Agent 리소스 삭제 필요');
    expect(html).toContain('최초 연동일 경우, 평균 10분 이내 완료됩니다.');
    expect(html).toContain('재연동일 경우, 평균 1영업일 소요됩니다.');
    expect(html).toContain('2 영업일 이상 지연 시 담당자에게 문의해주세요.');
  });

  it('gives them all the same body — one card in the design, one string here', () => {
    const bodies = new Set(step3Keys.map((key) => STEP_GUIDE_HTML[resolveSlot(key).guideName]));
    expect(bodies.size).toBe(1);
  });

  it('drops the design\'s empty fourth bullet rather than porting a blank row', () => {
    const html = STEP_GUIDE_HTML[resolveSlot('process.aws.auto.3').guideName];
    expect(html).not.toContain('<li></li>');
    expect(html.match(/<li>/g)).toHaveLength(3);
  });
});
