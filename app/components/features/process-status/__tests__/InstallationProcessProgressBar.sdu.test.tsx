// @vitest-environment jsdom

/**
 * `variant="sdu"` — the same seven-slot road, walked by four.
 *
 * The thing under test is a claim about POSITION, not about labels: 「4단계」 has to point
 * at the same slot for an SDU owner and for an AWS one, or an operator and an owner cannot
 * say 「4단계에서 막혀 있다」 to each other and mean one place. That is why the three steps
 * SDU does not walk are struck rather than removed, and why the fraction still counts to 7.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { ProcessStatus } from '@/lib/types';
import { installStepperStyles } from '@/lib/theme';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status/InstallationProcessProgressBar';

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

const block = (currentStep: ProcessStatus, variant?: 'sdu') => {
  const { container } = render(
    <InstallationProcessProgressBar currentStep={currentStep} variant={variant} />,
  );
  return within(container).getByRole('region', { name: '설치 진행' });
};

const tag = (el: HTMLElement) =>
  [...el.querySelectorAll('span')].find((s) => s.className === installStepperStyles.stepTag);
const row = (el: HTMLElement) => tag(el)?.textContent?.replace(/\s+/g, ' ').trim();
const cue = (el: HTMLElement) => within(el).getByRole('button', { name: /전체 단계/ });

/** The road, opened — the only state in which the seven slots are on screen. */
const opened = (currentStep: ProcessStatus, variant?: 'sdu') => {
  const el = block(currentStep, variant);
  fireEvent.click(cue(el));
  return el;
};

describe('InstallationProcessProgressBar — SDU names the four it walks', () => {
  it('re-labels 1 · 4 · 6 · 7 and leaves 2 · 3 · 5 under their original names', () => {
    const steps = [...opened(ProcessStatus.INSTALLING, 'sdu').querySelectorAll('li')];
    expect(steps.map((li) => li.textContent)).toEqual([
      '연동 대상 정의',
      // ⛔ Struck, not renamed and not removed. SDU has no approval at all, and a reader
      // whose road simply lacked 승인 대기 would read it as their own target having
      // skipped it rather than as the type not having one.
      '연동 대상 승인 대기',
      '연동 대상 반영중',
      // 4 is an upload, not an install — the one label whose old name would be an
      // instruction to do something that does not exist here.
      '데이터 업로드',
      '연결 테스트',
      'SDU 연동중',
      '완료',
    ]);
  });

  it('leaves the default road byte-identical', () => {
    const steps = [...opened(ProcessStatus.INSTALLING).querySelectorAll('li')];
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
    expect(opened(ProcessStatus.INSTALLING).querySelectorAll('i')).toHaveLength(7);
  });
});

describe('InstallationProcessProgressBar — SDU strikes three, with a reason', () => {
  it('strikes exactly 2 · 3 · 5 and says why on each', () => {
    const steps = [...opened(ProcessStatus.INSTALLING, 'sdu').querySelectorAll('li')];
    const struck = steps
      .map((li, index) => ({ step: index + 1, reason: li.getAttribute('title') }))
      .filter((it) => it.reason !== null);

    expect(struck).toEqual([
      { step: 2, reason: '승인 없음' },
      { step: 3, reason: '승인 없음' },
      // ⛔ NOT 「연결 테스트 없음」. The test happens — it is simply not this reader's to
      // run, and telling an owner it does not exist would be false about the product.
      { step: 5, reason: '연결 테스트는 BDC가 수행' },
    ]);
  });

  it('draws the struck labels in the struck tier, not the walked one', () => {
    const labels = [...opened(ProcessStatus.INSTALLING, 'sdu').querySelectorAll('li')].map(
      (li) => li.lastElementChild?.className ?? '',
    );
    for (const step of [2, 3, 5]) {
      expect(labels[step - 1]).toContain(installStepperStyles.labelSkipped);
    }
    // The strike is a real line-through, not just a quieter ink — the colour alone would
    // be one channel doing two jobs (WCAG 1.4.1).
    expect(installStepperStyles.labelSkipped).toContain('line-through');
    for (const step of [1, 6, 7]) {
      expect(labels[step - 1]).not.toContain(installStepperStyles.labelSkipped);
    }
  });

  it('gives a struck slot no bead — the road runs through it', () => {
    // Every dot on this road states a position relative to the reader (walked / here /
    // ahead). A struck step is none of the three, and `dotPending` would promise 「아직」
    // about something that never happens.
    const el = opened(ProcessStatus.INSTALLING, 'sdu');
    expect(el.querySelectorAll('i')).toHaveLength(4);
    const steps = [...el.querySelectorAll('li')];
    for (const step of [2, 3, 5]) {
      expect(steps[step - 1].querySelector('i')).toBeNull();
    }
  });
});

describe('InstallationProcessProgressBar — SDU counts to 7, and lands on the SDU step', () => {
  it.each([
    // The fold: two statuses onto 4, two onto 6.
    ['WAITING_TARGET_CONFIRMATION', ProcessStatus.WAITING_TARGET_CONFIRMATION, 1],
    ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL, 4],
    ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED, 4],
    ['INSTALLING', ProcessStatus.INSTALLING, 4],
    ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST, 6],
    ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED, 6],
  ] as const)('reports %s as 「7단계 중 %d단계」', (_name, status, sduStep) => {
    // ⛔ The denominator stays 7. Renumbering to 「4단계 중 2단계」 would make the owner's
    // 「4단계」 and the operator's 「4단계」 two different places.
    expect(row(block(status, 'sdu'))).toBe(`7단계 중 ${sduStep}단계`);
  });

  it('reports completion the way every other type does', () => {
    expect(row(block(ProcessStatus.INSTALLATION_COMPLETE, 'sdu'))).toBe('7단계 모두 완료');
  });

  it('marks exactly one slot current, and it is the SDU step', () => {
    const steps = [...opened(ProcessStatus.APPLYING_APPROVED, 'sdu').querySelectorAll('li')];
    expect(steps.filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
    // Status 3 (연동 대상 반영중) is itself struck on this road — the target is on 4.
    expect(steps[3].getAttribute('aria-current')).toBe('step');
  });

  it('drops the position on a status outside the seven, and still opens the road', () => {
    const el = block(99 as ProcessStatus, 'sdu');
    expect(row(el)).toBeUndefined();
    fireEvent.click(cue(el));
    const steps = [...el.querySelectorAll('li')];
    expect(steps).toHaveLength(7);
    expect(steps.some((li) => li.getAttribute('aria-current') === 'step')).toBe(false);
  });
});
