// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { ProcessStatus } from '@/lib/types';
import { installStepperStyles, projectHeaderStyles } from '@/lib/theme';
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

/**
 * The whole block, found the way a screen reader finds it (오너 11차 지시). Scoped to
 * this render's own container, not to `screen` — some tests below mount the component
 * twice to compare states, and a document-wide query matches both.
 */
const block = (currentStep: ProcessStatus, tcTag?: React.ReactNode) => {
  const { container } = render(
    <InstallationProcessProgressBar currentStep={currentStep} tcTag={tcTag} />,
  );
  return within(container).getByRole('region', { name: '설치 진행' });
};

/** The position row, whitespace-collapsed — it is built from several text nodes. */
const row = (el: HTMLElement) => el.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim();

const cue = (el: HTMLElement) => within(el).getByRole('button', { name: /전체 단계/ });

describe('InstallationProcessProgressBar — 설치 진행 전체 7단계 중 [4단계 Agent 설치]', () => {
  it('states name and position on one row (오너 14차 지시)', () => {
    const el = block(ProcessStatus.INSTALLING);
    // The block name and the position line share the head row: the name's parent is
    // the row container, and the sentence is its sibling — not a line below it.
    const head = within(el).getByText('설치 진행').parentElement;
    expect(head?.className).toBe(installStepperStyles.head);
    expect(head?.querySelector('p')?.className).toBe(installStepperStyles.summary);
    // No spaces between 중/4단계/Agent 설치: the gaps are layout, not text — the count
    // and the step's name are separate elements inside the tag.
    expect(row(el)).toBe('전체 7단계 중4단계Agent 설치');
  });

  it.each([
    [ProcessStatus.WAITING_TARGET_CONFIRMATION, '1단계', '연동 대상 DB 선택'],
    [ProcessStatus.WAITING_CONNECTION_TEST, '5단계', '연결 테스트'],
    [ProcessStatus.INSTALLATION_COMPLETE, '7단계', '완료'],
  ])('counts %s as %s and tags it %s', (step, position, label) => {
    const el = block(step);
    expect(row(el)).toContain(`중${position}`);
    expect(within(el).getByText(label)).toBeTruthy();
  });

  it('names only the step it is on while the road is folded', () => {
    const el = block(ProcessStatus.WAITING_TARGET_CONFIRMATION);
    expect(within(el).queryByText('완료')).toBeNull();
    expect(within(el).queryByText('Agent 설치')).toBeNull();
  });

  it('gives both counts the emphasis tier, and nothing else on the row', () => {
    // Position is the one fact this block exists to state, so the digits are what
    // steps up a size (14px in a 12px row). Quieten them and the block says nothing
    // at a glance that the step card below does not already say louder.
    const el = block(ProcessStatus.INSTALLING);
    const counts = [...el.querySelectorAll('b')];
    expect(counts.map((c) => c.textContent)).toEqual(['7', '4']);
    // The 4 lives inside the tag, so it wears the tag's ink — same size tier, no
    // second colour inside a two-word plate.
    expect(counts.map((c) => c.className)).toEqual([
      installStepperStyles.count,
      installStepperStyles.tagCount,
    ]);
    for (const token of [installStepperStyles.count, installStepperStyles.tagCount]) {
      expect(token).toContain('text-[14px]');
    }
    expect(installStepperStyles.summary).toContain('text-[12px]');
    // Different sizes on one line only sit right if the row aligns on the baseline —
    // and the tag is itself a line of two sizes, so it needs the same.
    expect(installStepperStyles.summary).toContain('items-baseline');
    expect(installStepperStyles.head).toContain('items-baseline');
    expect(installStepperStyles.stepTag).toContain('items-baseline');
  });

  it('marks where you are in blue, not in the path’s slate (오너 14차 지시)', () => {
    // The row now carries the block's name too, so the step has to be the thing the
    // eye lands on — and it must not be mistaken for the cue beside it, which is the
    // one blue on this row that is actually pressable.
    expect(installStepperStyles.stepTag).toContain('bg-[#E8F1FF]');
    expect(installStepperStyles.stepTag).toContain('text-[#1747B5]');
    expect(projectHeaderStyles.metaCue).toContain('text-[#0050D6]');
  });

  it('drops the position row on a status outside the seven', () => {
    // ProcessStatus is exactly these seven, but the value arrives over the wire —
    // an unknown one must not print 「0단계」 or crash on an undefined label.
    const el = block(99 as ProcessStatus);
    expect(row(el)).toBeUndefined();
    expect(within(el).getByText('설치 진행')).toBeTruthy();
  });
});

/**
 * 전체 단계 — the seven-step road, folded by default and opened on request
 * (오너 14차 지시). Same 「name + cue + body」 grammar as 설치 대상 one block above.
 */
describe('InstallationProcessProgressBar — 전체 단계 disclosure', () => {
  it('folds the road away at rest — the row is the whole block', () => {
    const el = block(ProcessStatus.INSTALLING);
    expect(el.querySelector('ol')).toBeNull();
    expect(el.querySelectorAll('li').length).toBe(0);
    expect(cue(el).getAttribute('aria-expanded')).toBe('false');
  });

  it('names all seven steps once opened', () => {
    const el = block(ProcessStatus.INSTALLING);
    fireEvent.click(cue(el));
    expect(cue(el).getAttribute('aria-expanded')).toBe('true');
    const steps = [...el.querySelectorAll('li')];
    expect(steps.map((li) => li.textContent)).toEqual([
      '연동 대상 DB 선택',
      '연동 대상 승인 대기',
      '연동 대상 반영중',
      'Agent 설치',
      '연결 테스트',
      '관리자 승인 대기',
      '완료',
    ]);
  });

  it('marks the current step, and only that one, as where you are', () => {
    const el = block(ProcessStatus.INSTALLING);
    fireEvent.click(cue(el));
    const steps = [...el.querySelectorAll('li')];
    expect(steps.filter((li) => li.getAttribute('aria-current') === 'step').length).toBe(1);
    expect(steps[3].getAttribute('aria-current')).toBe('step');
    // The label tiers say the same thing visually — one current, six rest.
    const labels = steps.map((li) => li.lastElementChild?.className);
    expect(labels.filter((c) => c?.includes(installStepperStyles.labelCurrent)).length).toBe(1);
  });

  it('walks the road only up to the current step', () => {
    const el = block(ProcessStatus.INSTALLING);
    fireEvent.click(cue(el));
    const dots = [...el.querySelectorAll('i')].map((i) => i.className);
    expect(dots.filter((c) => c.includes(installStepperStyles.dotDone)).length).toBe(3);
    expect(dots.filter((c) => c.includes(installStepperStyles.dotCurrent)).length).toBe(1);
    expect(dots.filter((c) => c.includes(installStepperStyles.dotPending)).length).toBe(3);
  });

  it('wires the cue to the road it opens', () => {
    const el = block(ProcessStatus.INSTALLING);
    fireEvent.click(cue(el));
    expect(el.querySelector('ol')?.id).toBe(cue(el).getAttribute('aria-controls'));
  });

  it('closes again on a second press', () => {
    const el = block(ProcessStatus.INSTALLING);
    fireEvent.click(cue(el));
    fireEvent.click(cue(el));
    expect(el.querySelector('ol')).toBeNull();
  });

  it('still opens the road on a status outside the seven, with nothing current', () => {
    // The route is a fact about the product, not about this target — an unknown
    // status must not take the reader's ability to see it.
    const el = block(99 as ProcessStatus);
    fireEvent.click(cue(el));
    const steps = [...el.querySelectorAll('li')];
    expect(steps.length).toBe(7);
    expect(steps.some((li) => li.getAttribute('aria-current') === 'step')).toBe(false);
  });
});

/**
 * The verdict tag only appears once the target has REACHED 연결 테스트 (step 5).
 * Before that the agent is not installed, so any surviving verdict describes a
 * previous cycle — drawing it tells the user the connection is fine about a
 * configuration that has never been tested.
 */
describe('InstallationProcessProgressBar — 연결 테스트 verdict tag', () => {
  const TAG = <span data-testid="tc-tag">최근 테스트 성공</span>;

  it.each([
    ['WAITING_TARGET_CONFIRMATION', ProcessStatus.WAITING_TARGET_CONFIRMATION],
    ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL],
    ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED],
    ['INSTALLING', ProcessStatus.INSTALLING],
  ])('hides the tag at %s (step 5 not reached)', (_name, step) => {
    expect(within(block(step, TAG)).queryByTestId('tc-tag')).toBeNull();
  });

  it.each([
    ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST],
    ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED],
    ['INSTALLATION_COMPLETE', ProcessStatus.INSTALLATION_COMPLETE],
  ])('shows the tag at %s', (_name, step) => {
    expect(within(block(step, TAG)).getByTestId('tc-tag')).toBeTruthy();
  });

  /**
   * The gate must not render the tag's element on the hidden steps — the tag fetches
   * latest_version on mount, so a slot that merely hid it would keep the request.
   * Asserting on the SLOT (not the tag) pins that `tagSlot` is what the guard wraps.
   */
  it('renders no tag slot at all before the step is reached', () => {
    const slots = (step: ProcessStatus) =>
      [...block(step, TAG).querySelectorAll('span')].filter(
        (el) => el.className === installStepperStyles.tagSlot,
      ).length;
    expect(slots(ProcessStatus.INSTALLING)).toBe(0);
    expect(slots(ProcessStatus.WAITING_CONNECTION_TEST)).toBe(1);
  });

  it('still draws nothing at step 5 when no test has run', () => {
    expect(
      within(block(ProcessStatus.WAITING_CONNECTION_TEST)).queryByTestId('tc-tag'),
    ).toBeNull();
  });

  /**
   * The verdict rides the head row, so folding the road away must not fold it with
   * them: it is the freshest fact on this header and the road is reference material.
   */
  it('keeps the verdict on the row whether the road is open or shut', () => {
    const el = block(ProcessStatus.WAITING_CONNECTION_TEST, TAG);
    expect(within(el).getByTestId('tc-tag')).toBeTruthy();
    fireEvent.click(cue(el));
    expect(within(el).getByTestId('tc-tag')).toBeTruthy();
    // …and on the row, not inside the road that just opened.
    expect(el.querySelector('ol')?.contains(within(el).getByTestId('tc-tag'))).toBe(false);
  });

  /**
   * The slot used to be `absolute top-full` under the 연결 테스트 dot, which reflowed
   * nothing — tighten the body's `pt-8` and it would silently overlap the first card,
   * so a source-string pin had to stand in for the geometry. Now it simply follows
   * the step tag in flow. This pins the property that fix rests on.
   */
  it('keeps the verdict in flow, so it can never overlap the card below', () => {
    expect(installStepperStyles.tagSlot).not.toContain('absolute');
    expect(installStepperStyles.tagSlot).not.toContain('top-full');
  });
});
