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
 * The road, found the way a screen reader finds it. It draws no visible name any more
 * (오너 2026-08-28 — the drawer titles nothing but the description), but it keeps an
 * `aria-label`, because an unnamed list of seven labels says nothing about what the seven
 * are. Scoped to this render's own container, not to `screen`: a document-wide query
 * would match every mount in the file.
 */
const road = (currentStep: ProcessStatus, variant?: 'sdu') => {
  const { container } = render(
    <InstallationProcessProgressBar currentStep={currentStep} variant={variant} />,
  );
  return { el: within(container).getByRole('list', { name: '설치 진행' }), container };
};

describe('InstallationProcessProgressBar — the road, and nothing else', () => {
  /**
   * ⛔ The regression this suite exists to catch. The component used to be a named block
   * with its own head row, position tag, 연결 테스트 verdict slot and 「전체 단계」 cue,
   * standing under a second named block. All of that moved to `ProjectPageMeta` so the
   * header draws ONE block and ONE cue; putting any of it back here restores the two-cue
   * header this round removed. The position tag and the verdict are asserted in
   * `ProjectPageMeta.test.tsx` now, on the head row that owns them.
   */
  it('draws no name, no plate and no press of its own', () => {
    const { el, container } = road(ProcessStatus.INSTALLING);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    // No position plate, and no `<b>` digits — the header's head row states those.
    expect(
      [...container.querySelectorAll('span')].filter(
        (s) => s.className === installStepperStyles.stepTag,
      ),
    ).toHaveLength(0);
    expect(container.querySelectorAll('b')).toHaveLength(0);
    expect(within(el).queryByText('설치 진행')).toBeNull();
    // The road IS the component: nothing wraps it any more.
    expect(el.tagName).toBe('OL');
    expect(el).toBe(container.firstElementChild);
  });

  it('names all seven steps, in order', () => {
    const steps = [...road(ProcessStatus.INSTALLING).el.querySelectorAll('li')];
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
    const steps = [...road(ProcessStatus.INSTALLING).el.querySelectorAll('li')];
    expect(steps.filter((li) => li.getAttribute('aria-current') === 'step').length).toBe(1);
    expect(steps[3].getAttribute('aria-current')).toBe('step');
    // The label tiers say the same thing visually — one current, six rest.
    const labels = steps.map((li) => li.lastElementChild?.className);
    expect(labels.filter((c) => c?.includes(installStepperStyles.labelCurrent)).length).toBe(1);
  });

  it('walks the road only up to the current step', () => {
    const dots = [...road(ProcessStatus.INSTALLING).el.querySelectorAll('i')].map(
      (i) => i.className,
    );
    expect(dots.filter((c) => c.includes(installStepperStyles.dotDone)).length).toBe(3);
    expect(dots.filter((c) => c.includes(installStepperStyles.dotCurrent)).length).toBe(1);
    expect(dots.filter((c) => c.includes(installStepperStyles.dotPending)).length).toBe(3);
  });

  it('still draws the road on a status outside the seven, with nothing current', () => {
    // The route is a fact about the product, not about this target — an unknown status
    // must not take the reader's ability to see it, or crash on an undefined label.
    const steps = [...road(99 as ProcessStatus).el.querySelectorAll('li')];
    expect(steps.length).toBe(7);
    expect(steps.some((li) => li.getAttribute('aria-current') === 'step')).toBe(false);
  });

  it('carries its own spacing, now that the section wrapper is gone', () => {
    // The road used to sit inside a `<section>` that supplied the block's 18px. It is a
    // sibling of the description inside one drawer now, so the 18px lives on the list —
    // drop it and the road butts against the paragraph above it.
    expect(installStepperStyles.list).toContain('mt-[18px]');
  });
});
