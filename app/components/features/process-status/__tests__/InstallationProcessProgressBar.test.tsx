// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { ProcessStatus } from '@/lib/types';
import { cardStyles, installStepperStyles, primaryColors, projectHeaderStyles } from '@/lib/theme';
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

/**
 * The position plate. Matched by exact token equality rather than by tag name: after
 * 오너 16차 지시 the whole statement lives on this one span, so there is no longer a
 * `<p>` of prose to read, and an equality check against the same token the component
 * renders cannot drift the way a structural selector can.
 */
const tag = (el: HTMLElement) =>
  [...el.querySelectorAll('span')].find((s) => s.className === installStepperStyles.stepTag);

/** The plate's text, whitespace-collapsed — it is built from several text nodes. */
const row = (el: HTMLElement) => tag(el)?.textContent?.replace(/\s+/g, ' ').trim();

const cue = (el: HTMLElement) => within(el).getByRole('button', { name: /전체 단계/ });

describe('InstallationProcessProgressBar — 설치 진행 [7단계 중 4단계 · Agent 설치]', () => {
  it('states name and position on one row (오너 14차 지시)', () => {
    const el = block(ProcessStatus.INSTALLING);
    // The block name and the position plate share the head row: the name's parent is
    // the row container, and the plate is its sibling — not a line below it.
    const head = within(el).getByText('설치 진행').parentElement;
    expect(head?.className).toBe(installStepperStyles.head);
    expect(tag(el)?.parentElement).toBe(head);
    // No space around the middot: the spacing is layout, the dot is the text — the
    // digits, the separator and the step's name are three elements inside the plate.
    expect(row(el)).toBe('7단계 중 4단계·Agent 설치');
  });

  it('breaks the position off the step name with a middot (오너 19차 지시)', () => {
    // Inside a plate this small a 6px gap read as spacing rather than a break, so the
    // position and the label ran together. The dot is the seam, and it is decoration:
    // it carries no class of its own and is hidden from the accessible name.
    const dot = [...block(ProcessStatus.INSTALLING).querySelectorAll('span')].find(
      (s) => s.textContent === '·',
    );
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    // ⛔ No class — a separator in a second tint would be a mark that means something.
    expect(dot?.className).toBe('');
  });

  it.each([
    [ProcessStatus.WAITING_TARGET_CONFIRMATION, '1단계', '연동 대상 DB 선택'],
    [ProcessStatus.WAITING_CONNECTION_TEST, '5단계', '연결 테스트'],
  ])('counts %s as %s and tags it %s', (step, position, label) => {
    const el = block(step);
    // 「N단계 중 」 — the space is real text (`{' '}`), unlike the gap before the label.
    expect(row(el)).toContain(`중 ${position}`);
    expect(within(el).getByText(label)).toBeTruthy();
  });

  it('drops the position once there is none left to report (오너 18차 지시)', () => {
    // 「7단계 중 7단계 완료」 stated completion three ways. The last step is the one whose
    // label is not work — so the plate reports the sequence, not a place inside it.
    const el = block(ProcessStatus.INSTALLATION_COMPLETE);
    expect(row(el)).toBe('7단계 모두 완료');
    expect(row(el)).not.toContain('중');
    // The total survives because it is what got completed; the position does not.
    expect([...el.querySelectorAll('b')].map((c) => c.textContent)).toEqual(['7']);
  });

  it('names only the step it is on while the road is folded', () => {
    const el = block(ProcessStatus.WAITING_TARGET_CONFIRMATION);
    expect(within(el).queryByText('완료')).toBeNull();
    expect(within(el).queryByText('Agent 설치')).toBeNull();
  });

  it('puts both digits on the one plate, in the plate’s own ink (오너 16차 지시)', () => {
    // The total used to stand outside the tag as 12px prose (「전체 7단계 중」) with its
    // digit in near-black. The owner deleted that line, so the plate states total AND
    // position and the row has no running text left between the name and the tags.
    const el = block(ProcessStatus.INSTALLING);
    const counts = [...el.querySelectorAll('b')];
    expect(counts.map((c) => c.textContent)).toEqual(['7', '4']);
    expect(counts.every((c) => c.className === installStepperStyles.tagCount)).toBe(true);
    expect(installStepperStyles.tagCount).toContain('text-[14px]');
    // ⛔ No ink of its own: a near-black digit on this fill would be a second colour
    // inside what is now a single statement.
    expect(installStepperStyles.tagCount).not.toMatch(/text-\[#/);
    // Different sizes on one line only sit right if the row aligns on the baseline —
    // and the plate is itself a line of two sizes, so it needs the same.
    expect(installStepperStyles.head).toContain('items-baseline');
    expect(installStepperStyles.stepTag).toContain('items-baseline');
  });

  it('keeps the 14px name and the 14px digits apart by plate, not by size', () => {
    // 오너 16차 지시 raised 설치 진행 to the digits' own tier, so size no longer separates
    // the block's NAME from the position it introduces. What separates them now is the
    // plate: slate on the page wash versus blue on a blue fill. ⛔ Never give the name
    // the tag's ink — that is the only remaining channel.
    expect(projectHeaderStyles.blockLabel).toContain('text-[14px]');
    expect(installStepperStyles.tagCount).toContain('text-[14px]');
    expect(projectHeaderStyles.blockLabel).toContain('text-[#4E5968]');
    expect(installStepperStyles.stepTag).toContain('text-[#0050D6]');
    expect(installStepperStyles.stepTag).toContain('bg-[#E8F1FF]');
    expect(projectHeaderStyles.blockLabel).not.toMatch(/bg-\[/);
  });

  it('marks where you are in blue, not in the path’s slate (오너 14차 지시)', () => {
    // The row now carries the block's name too, so the step has to be the thing the
    // eye lands on. Slate is the path's tag vocabulary one tier above.
    expect(installStepperStyles.stepTag).toContain('bg-[#E8F1FF]');
    expect(installStepperStyles.stepTag).toContain('text-[#0050D6]');
    expect(installStepperStyles.stepTag).not.toContain('#EAEEF7'); // the path's slate
  });

  it('wears the same plate as the 「N단계」 tag over the step card', () => {
    // Same fact rendered twice, both on screen at once: this row says 「4단계 Agent
    // 설치」 and the card below titles itself 「4단계 / Agent 설치」. One fill in two
    // tints reads as two meanings — this shipped as #1747B5 for a round because the
    // ink was reasoned against `metaCue` and never against the card tag.
    const inkOf = (cls: string) => cls.match(/text-\[(#[0-9A-Fa-f]{6})\]/)?.[1];
    const fillOf = (cls: string) => cls.match(/bg-\[(#[0-9A-Fa-f]{6})\]/)?.[1];
    // cardStyles.stepTag builds its pair from primaryColors, so resolve through those.
    expect(fillOf(installStepperStyles.stepTag)).toBe(fillOf(primaryColors.bgLight));
    expect(inkOf(installStepperStyles.stepTag)).toBe(inkOf(primaryColors.textOnLight));
    expect(cardStyles.stepTag).toContain(primaryColors.bgLight);
    expect(cardStyles.stepTag).toContain(primaryColors.textOnLight);
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

  it('wires the cue to everything that press reveals, not just the road', () => {
    // `aria-controls` is an ID list. The verdict is the second thing this press
    // reveals and it lives up on the head row — outside the <ol> and before it in the
    // DOM — so a single-id attribute leaves it with no tie to the control.
    const el = block(ProcessStatus.WAITING_CONNECTION_TEST, <span id="x">v</span>);
    fireEvent.click(cue(el));
    const controlled = cue(el).getAttribute('aria-controls')?.split(' ');
    expect(controlled).toEqual(['install-progress-steps', 'install-progress-verdict']);
    expect(el.querySelector('ol')?.id).toBe(controlled?.[0]);
    expect(el.querySelector(`#${controlled?.[1]}`)?.className).toBe(
      installStepperStyles.tagSlot,
    );
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
 * Two gates on the verdict tag, and both must hold.
 *
 * 1. The target has REACHED 연결 테스트 (step 5). Before that the agent is not
 *    installed, so any surviving verdict describes a previous cycle — drawing it
 *    tells the user the connection is fine about a configuration never tested.
 * 2. The road is open (오너 14차 지시 후속). The verdict is detail about one step, so
 *    it comes with the press that names the steps.
 */
describe('InstallationProcessProgressBar — 연결 테스트 verdict tag', () => {
  const TAG = <span data-testid="tc-tag">최근 테스트 성공</span>;

  /** The block with the road already open — the only state that can show a verdict. */
  const opened = (step: ProcessStatus) => {
    const el = block(step, TAG);
    fireEvent.click(cue(el));
    return el;
  };

  it.each([
    ['WAITING_TARGET_CONFIRMATION', ProcessStatus.WAITING_TARGET_CONFIRMATION],
    ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL],
    ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED],
    ['INSTALLING', ProcessStatus.INSTALLING],
  ])('hides the tag at %s even with the road open (step 5 not reached)', (_name, step) => {
    expect(within(opened(step)).queryByTestId('tc-tag')).toBeNull();
  });

  it.each([
    ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST],
    ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED],
    ['INSTALLATION_COMPLETE', ProcessStatus.INSTALLATION_COMPLETE],
  ])('shows the tag at %s once the road is open', (_name, step) => {
    expect(within(opened(step)).getByTestId('tc-tag')).toBeTruthy();
  });

  it('folds the verdict away with the road (오너 14차 지시 후속)', () => {
    const el = block(ProcessStatus.WAITING_CONNECTION_TEST, TAG);
    expect(within(el).queryByTestId('tc-tag')).toBeNull();
    fireEvent.click(cue(el));
    expect(within(el).getByTestId('tc-tag')).toBeTruthy();
    fireEvent.click(cue(el));
    expect(within(el).queryByTestId('tc-tag')).toBeNull();
  });

  it('keeps the verdict on the row, not inside the road it opens with', () => {
    // Hanging it back on the 연결 테스트 step is the obvious way to fold it with the
    // road — and it is the way that brings back the absolute-positioning bug below.
    const el = opened(ProcessStatus.WAITING_CONNECTION_TEST);
    expect(el.querySelector('ol')?.contains(within(el).getByTestId('tc-tag'))).toBe(false);
  });

  /**
   * Neither gate may merely hide the tag — `TcHeaderTag` fetches latest_version on
   * mount, so a slot that rendered and hid it would keep the request. Asserting on
   * the SLOT (not the tag) pins that `tagSlot` is what both guards wrap.
   */
  it('renders no tag slot at all while either gate is shut', () => {
    const slots = (el: HTMLElement) =>
      [...el.querySelectorAll('span')].filter(
        (s) => s.className === installStepperStyles.tagSlot,
      ).length;
    expect(slots(block(ProcessStatus.WAITING_CONNECTION_TEST, TAG))).toBe(0); // road shut
    expect(slots(opened(ProcessStatus.INSTALLING))).toBe(0); // step not reached
    expect(slots(opened(ProcessStatus.WAITING_CONNECTION_TEST))).toBe(1);
  });

  it('still draws nothing at step 5 when no test has run', () => {
    const el = block(ProcessStatus.WAITING_CONNECTION_TEST);
    fireEvent.click(cue(el));
    expect(within(el).queryByTestId('tc-tag')).toBeNull();
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
