// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';
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

/**
 * The whole block, found the way a screen reader finds it (오너 11차 지시). Scoped to
 * this render's own container, not to `screen` — two of the tests below mount the
 * component twice to compare states, and a document-wide query matches both.
 */
const block = (currentStep: ProcessStatus, tcTag?: React.ReactNode) => {
  const { container } = render(
    <InstallationProcessProgressBar currentStep={currentStep} tcTag={tcTag} />,
  );
  return within(container).getByRole('region', { name: '설치 진행' });
};

/** The position sentence, whitespace-collapsed — it is built from four text nodes. */
const sentence = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ').trim();

describe('InstallationProcessProgressBar — 전체 N단계 중 M단계', () => {
  it('states the position in one sentence, not a seven-dot road (오너 13차 지시)', () => {
    const el = block(ProcessStatus.INSTALLING);
    expect(sentence(el)).toBe('설치 진행전체 7단계 중 4단계Agent 설치');
    // The road is gone: no list, no per-step items, no dots.
    expect(el.querySelectorAll('li').length).toBe(0);
    expect(el.querySelector('ol')).toBeNull();
  });

  it.each([
    [ProcessStatus.WAITING_TARGET_CONFIRMATION, '1단계', '연동 대상 DB 선택'],
    [ProcessStatus.WAITING_CONNECTION_TEST, '5단계', '연결 테스트'],
    [ProcessStatus.INSTALLATION_COMPLETE, '7단계', '완료'],
  ])('counts %s as %s and tags it %s', (step, position, label) => {
    const el = block(step);
    expect(sentence(el)).toContain(`중 ${position}`);
    expect(within(el).getByText(label)).toBeTruthy();
  });

  it('names only the step it is on — the other six live in the cards below', () => {
    const el = block(ProcessStatus.WAITING_TARGET_CONFIRMATION);
    expect(within(el).queryByText('완료')).toBeNull();
    expect(within(el).queryByText('Agent 설치')).toBeNull();
  });

  it('gives both counts the emphasis tier, and nothing else on the line', () => {
    // Position is the one fact this block exists to state, so the digits are what
    // steps up a size (14px in a 12px sentence). Quieten them and the block says
    // nothing at a glance that the step card below does not already say louder.
    const el = block(ProcessStatus.INSTALLING);
    const counts = [...el.querySelectorAll('b')];
    expect(counts.map((c) => c.textContent)).toEqual(['7', '4']);
    for (const c of counts) expect(c.className).toBe(installStepperStyles.count);
    expect(installStepperStyles.count).toContain('text-[14px]');
    expect(installStepperStyles.summary).toContain('text-[12px]');
    // Different sizes on one line only sit right if the row aligns on the baseline.
    expect(installStepperStyles.summary).toContain('items-baseline');
  });

  it('drops the position line on a status outside the seven', () => {
    // ProcessStatus is exactly these seven, but the value arrives over the wire —
    // an unknown one must not print 「0단계」 or crash on an undefined label.
    const el = block(99 as ProcessStatus);
    expect(sentence(el)).toBe('설치 진행');
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
   * The slot used to be `absolute top-full` under the 연결 테스트 dot, which reflowed
   * nothing — tighten the body's `pt-8` and it would silently overlap the first card,
   * so a source-string pin had to stand in for the geometry. With the road gone the
   * tag simply follows the step tag in flow, and the clearance problem with it. This
   * pins the property that fix rests on: it must never go out of flow again.
   */
  it('keeps the verdict in flow, so it can never overlap the card below', () => {
    expect(installStepperStyles.tagSlot).not.toContain('absolute');
    expect(installStepperStyles.tagSlot).not.toContain('top-full');
  });
});
