// @vitest-environment jsdom

/**
 * `variant="sdu"` — SDU's own four-step road (오너 2026-08-27).
 *
 * The owner walks four steps and is told four steps: no struck slots, no seven-step
 * denominator. The wire lattice still has seven statuses, so what is under test here is
 * the FOLD — several statuses landing on one slot — plus the promise that the default
 * seven-step road is untouched by any of it.
 *
 * The fold is asserted on `installRoadPosition` rather than on rendered text, because the
 * position tag left this component for the 설치 대상 head row (오너 2026-08-28). The
 * numbers are the thing the fold produces; `ProjectPageMeta.test.tsx` covers the tag that
 * prints them.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { ProcessStatus } from '@/lib/types';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status/InstallationProcessProgressBar';
import { installRoadPosition } from '@/app/components/features/process-status/install-road';

vi.stubGlobal('matchMedia', () => ({
  matches: false,
  media: '',
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
}));

const road = (currentStep: ProcessStatus, variant?: 'sdu') => {
  const { container } = render(
    <InstallationProcessProgressBar currentStep={currentStep} variant={variant} />,
  );
  return within(container).getByRole('list', { name: '설치 진행' });
};

/** What the head row would print: 「4단계 중 2단계」, or nothing off the road. */
const position = (currentStep: ProcessStatus, variant?: 'sdu') => {
  const { index, total } = installRoadPosition(currentStep, variant);
  if (index < 0) return undefined;
  return index === total - 1 ? `${total}단계 모두 완료` : `${total}단계 중 ${index + 1}단계`;
};

describe('InstallationProcessProgressBar — SDU draws its own four steps', () => {
  it('draws exactly the four, in order, and nothing the owner does not walk', () => {
    const steps = [...road(ProcessStatus.INSTALLING, 'sdu').querySelectorAll('li')];
    expect(steps.map((li) => li.textContent)).toEqual([
      '연동 대상 정의',
      '데이터 업로드',
      'SDU 연동중',
      '완료',
    ]);
    // 승인 대기 · 연동 대상 반영중 · 연결 테스트 are not on this road at all any more —
    // neither struck through nor greyed. They are steps of a different flow.
    expect(steps.filter((li) => li.hasAttribute('title'))).toHaveLength(0);
    expect(road(ProcessStatus.INSTALLING, 'sdu').querySelectorAll('i')).toHaveLength(4);
  });

  it('leaves the default road byte-identical', () => {
    const steps = [...road(ProcessStatus.INSTALLING).querySelectorAll('li')];
    expect(steps.map((li) => li.textContent)).toEqual([
      '연동 대상 DB 선택',
      '연동 대상 승인 대기',
      '연동 대상 반영중',
      'Agent 설치',
      '연결 테스트',
      '관리자 승인 대기',
      '완료',
    ]);
    // No slot is struck and none has lost its bead when the variant is absent.
    expect(steps.filter((li) => li.hasAttribute('title'))).toHaveLength(0);
    expect(road(ProcessStatus.INSTALLING).querySelectorAll('i')).toHaveLength(7);
  });
});

describe('InstallationProcessProgressBar — no slot is struck any more', () => {
  it('draws every SDU label in a walked tier, never the struck one', () => {
    const labels = [...road(ProcessStatus.INSTALLING, 'sdu').querySelectorAll('li')].map(
      (li) => li.lastElementChild?.className ?? '',
    );
    // ⛔ The line-through tier belonged to the seven-slot road. A four-step road has no
    // step to strike: every slot on it is one the owner walks. Matched on the utility
    // itself, not on a token name — a struck label re-added under any other name still
    // trips this.
    for (const label of labels) {
      expect(label).not.toContain('line-through');
    }
  });
});

describe('installRoadPosition — SDU counts to 4, and lands on the SDU step', () => {
  it.each([
    // The fold: three statuses onto 2, two onto 3.
    ['WAITING_TARGET_CONFIRMATION', ProcessStatus.WAITING_TARGET_CONFIRMATION, 1],
    ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL, 2],
    ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED, 2],
    ['INSTALLING', ProcessStatus.INSTALLING, 2],
    ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST, 3],
    ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED, 3],
  ] as const)('reports %s as 「4단계 중 %d단계」', (_name, status, sduStep) => {
    expect(position(status, 'sdu')).toBe(`4단계 중 ${sduStep}단계`);
  });

  it('reports completion in the same grammar the seven-step road uses', () => {
    expect(position(ProcessStatus.INSTALLATION_COMPLETE, 'sdu')).toBe('4단계 모두 완료');
    expect(position(ProcessStatus.INSTALLATION_COMPLETE)).toBe('7단계 모두 완료');
  });

  it('marks exactly one slot current, and it is the SDU step', () => {
    const steps = [...road(ProcessStatus.APPLYING_APPROVED, 'sdu').querySelectorAll('li')];
    expect(steps.filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
    // 연동 대상 반영중 is not a slot here — the target is on 2단계 데이터 업로드.
    expect(steps[1].getAttribute('aria-current')).toBe('step');
  });

  it('drops the position on a status outside the seven, and still draws the road', () => {
    expect(position(99 as ProcessStatus, 'sdu')).toBeUndefined();
    const steps = [...road(99 as ProcessStatus, 'sdu').querySelectorAll('li')];
    expect(steps).toHaveLength(4);
    expect(steps.some((li) => li.getAttribute('aria-current') === 'step')).toBe(false);
  });
});
