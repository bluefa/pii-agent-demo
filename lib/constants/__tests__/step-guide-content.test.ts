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
 * Steps 2, 3 and 6 carry one owner-authored body each, and each is meant for EVERY
 * integration type. The copy is only correct if it actually reaches all of them, so
 * the slot list is derived from the registry rather than hand-written: a new
 * provider's step joins these tests by existing.
 */
const slotsForStep = (step: '2' | '3' | '6') =>
  (Object.keys(GUIDE_SLOTS) as GuideSlotKey[]).filter((key) => key.endsWith(`.${step}`));

const bodyFor = (key: GuideSlotKey) => STEP_GUIDE_HTML[resolveSlot(key).guideName];

describe.each([
  {
    step: '2' as const,
    lines: [
      'PII Agent 담당자의 검토를 기다리고 있어요',
      '제출하신 DB 연동 대상 목록을 담당자가 순차적으로 검토하고 있어요.',
      'Step 1로 돌아가',
      '평균 1영업일 이내 검토가 완료됩니다.',
      '2영업일 이상 지연 시 담당자에게 문의해 주세요.',
    ],
    bullets: 2,
  },
  {
    step: '3' as const,
    lines: [
      '담당자가 연동을 위한 환경을 구성하고 있어요',
      '환경 구성이 완료되면 다음 단계로 넘어갑니다.',
      '이전에 설치된 PII Agent 리소스 삭제 필요',
      '최초 연동일 경우, 평균 10분 이내 완료됩니다.',
      '재연동일 경우, 평균 1영업일 소요됩니다.',
      '2영업일 이상 지연 시 담당자에게 문의해 주세요.',
    ],
    bullets: 3,
  },
  {
    step: '6' as const,
    lines: [
      'meta/sample data가 정상 수집되는지 담당자가 확인하고 있어요',
      '단계로 넘어가요.',
      '별도 조치가 필요한 경우 담당자가 개별 연락드릴 예정입니다.',
      '평균 1영업일 소요되는 과정입니다.',
      '수집해야 할 데이터가 클 경우, 더 오래 소요될 수 있어요.',
      '3영업일 이상 지연 시 담당자에게 문의해 주세요.',
    ],
    bullets: 3,
  },
])('step $step — the owner copy reaches every CSP', ({ step, lines, bullets }) => {
  const keys = slotsForStep(step);

  it('covers AWS (both variants), Azure, GCP and IDC', () => {
    expect(keys.sort()).toEqual([
      `process.aws.auto.${step}`,
      `process.aws.manual.${step}`,
      `process.azure.${step}`,
      `process.gcp.${step}`,
      `process.idc.${step}`,
    ]);
  });

  it.each(keys)('%s renders it', (key) => {
    const html = bodyFor(key);
    for (const line of lines) expect(html).toContain(line);
  });

  it('gives them all the same body — one card authored, one string here', () => {
    expect(new Set(keys.map(bodyFor)).size).toBe(1);
  });

  it(`has exactly ${bullets} bullets and no blank row`, () => {
    const html = bodyFor(keys[0]);
    expect(html).not.toContain('<li></li>');
    expect(html.match(/<li>/g)).toHaveLength(bullets);
  });
});

describe('step 2 — the guide points at a button that renders', () => {
  it('names 다시 요청하기, never 전체 요청 취소', () => {
    const html = bodyFor('process.aws.auto.2');
    // ⛔ `WaitingApprovalCancelButton` renders 「다시 요청하기」. 「전체 요청 취소」 is a label
    // no screen in this app shows — putting it back sends the reader hunting for it.
    expect(html).toContain('<strong>다시 요청하기</strong>');
    expect(html).not.toContain('전체 요청 취소');
  });
});

describe('the three owner steps spell 영업일 one way', () => {
  it.each(['2', '3', '6'] as const)('step %s has no space before 영업일', (step) => {
    expect(bodyFor(slotsForStep(step)[0])).not.toMatch(/\d\s+영업일/);
  });
});
