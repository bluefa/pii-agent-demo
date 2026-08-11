// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
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

describe('InstallationProcessProgressBar', () => {
  it('renders 7 steps for any ProcessStatus', () => {
    const { container } = render(
      <InstallationProcessProgressBar
        currentStep={ProcessStatus.INSTALLING}
      />,
    );
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(7);
  });

  it('marks the current ProcessStatus step as aria-current', () => {
    const { container } = render(
      <InstallationProcessProgressBar
        currentStep={ProcessStatus.INSTALLING}
      />,
    );
    const currentLi = container.querySelector('li[aria-current="step"]');
    expect(currentLi).not.toBeNull();
    // INSTALLING is index 3 (0-based) — 4th step
    const items = container.querySelectorAll('li');
    expect(items[3]).toBe(currentLi);
  });

  it('keeps final INSTALLATION_COMPLETE as the current step', () => {
    const { container } = render(
      <InstallationProcessProgressBar
        currentStep={ProcessStatus.INSTALLATION_COMPLETE}
      />,
    );
    const items = container.querySelectorAll('li');
    expect(container.querySelector('li[aria-current="step"]')).toBe(items[6]);
  });

  it('shows the 설치 진행 block label without a position count', () => {
    const { getByText, queryByText } = render(
      <InstallationProcessProgressBar currentStep={ProcessStatus.WAITING_APPROVAL} />,
    );
    expect(getByText('설치 진행')).toBeTruthy();
    expect(queryByText('/ 7 단계')).toBeNull();
  });

  it('renders Korean install labels', () => {
    const { getByText } = render(
      <InstallationProcessProgressBar
        currentStep={ProcessStatus.WAITING_TARGET_CONFIRMATION}
      />,
    );
    expect(getByText('연동 대상 DB 선택')).toBeTruthy();
    expect(getByText('완료')).toBeTruthy();
  });

  /**
   * The 연결 테스트 verdict tag is absolutely positioned, so it hangs into space the
   * step LAYOUTS own, not this component. Measured live at 1010: the stepper's own
   * `pb-[18px]` plus the body column's `pt-8` give 50px below the last label, the tag
   * takes 34px of it (`mt-1.5` + a 28px-tall chip), and 16px of clearance is left to
   * the first card.
   *
   * Nothing else catches a change here. Tighten `pt-8` to `pt-2` and the tag OVERLAPS
   * the card instead of pushing it — out-of-flow boxes reflow nothing — so the page
   * still renders, every test still passes, and only a human looking at the screen
   * would notice.
   *
   * This is a source-string pin, not a layout measurement: jsdom computes no
   * geometry, so it fails when one of the four inputs is EDITED, and equally when
   * one is merely reordered or moved into a token. That false-positive is the price
   * of the tripwire — it fires, you re-derive the 50px, you update the string. What
   * it cannot catch is the tag growing taller from a longer label or a bigger font.
   */
  it('pins the four values the absolute tag slot clearance is made of', () => {
    expect(installStepperStyles.tagSlot).toContain('absolute');
    expect(installStepperStyles.tagSlot).toContain('top-full');
    expect(installStepperStyles.tagSlot).toContain('mt-1.5');
    expect(installStepperStyles.wrap).toContain('pb-[18px]');

    const root = path.resolve(__dirname, '../../../../..');
    for (const layout of [
      'app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.tsx',
      'app/target-sources/[targetSourceId]/_components/idc/IdcTargetSourceLayout.tsx',
    ]) {
      const src = readFileSync(path.join(root, layout), 'utf8');
      expect(src, `${layout}: body top padding feeds the tag's clearance`).toContain(
        'px-10 pt-8 pb-20',
      );
    }
  });

  /**
   * The verdict tag only appears once the target has REACHED 연결 테스트 (step 5).
   * Before that the agent is not installed, so any surviving verdict describes a
   * previous cycle — drawing it tells the user the connection is fine about a
   * configuration that has never been tested.
   */
  describe('연결 테스트 verdict tag', () => {
    const TAG = <span data-testid="tc-tag">최근 테스트 성공</span>;

    it.each([
      ['WAITING_TARGET_CONFIRMATION', ProcessStatus.WAITING_TARGET_CONFIRMATION],
      ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL],
      ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED],
      ['INSTALLING', ProcessStatus.INSTALLING],
    ])('hides the tag at %s (step 5 not reached)', (_name, step) => {
      const { queryByTestId } = render(
        <InstallationProcessProgressBar currentStep={step} tcTag={TAG} />,
      );
      expect(queryByTestId('tc-tag')).toBeNull();
    });

    it.each([
      ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST],
      ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED],
      ['INSTALLATION_COMPLETE', ProcessStatus.INSTALLATION_COMPLETE],
    ])('shows the tag at %s', (_name, step) => {
      const { queryByTestId } = render(
        <InstallationProcessProgressBar currentStep={step} tcTag={TAG} />,
      );
      expect(queryByTestId('tc-tag')).not.toBeNull();
    });

    /**
     * The gate must not render the tag's element on the hidden steps — the tag
     * fetches latest_version on mount, so a slot that merely hides it visually
     * would keep the request. Asserting on the SLOT (not the tag) pins that:
     * `tagSlot` is what the guard wraps.
     */
    it('renders no tag slot at all before the step is reached', () => {
      const slotCount = (step: ProcessStatus) => {
        const { container } = render(
          <InstallationProcessProgressBar currentStep={step} tcTag={TAG} />,
        );
        return [...container.querySelectorAll('span')].filter(
          (el) => el.className === installStepperStyles.tagSlot,
        ).length;
      };
      expect(slotCount(ProcessStatus.INSTALLING)).toBe(0);
      expect(slotCount(ProcessStatus.WAITING_CONNECTION_TEST)).toBe(1);
    });

    it('still draws nothing at step 5 when no test has run', () => {
      const { container } = render(
        <InstallationProcessProgressBar currentStep={ProcessStatus.WAITING_CONNECTION_TEST} />,
      );
      expect(container.querySelector('[data-testid="tc-tag"]')).toBeNull();
    });
  });

  it('exposes the install ariaLabel on nav', () => {
    const { container } = render(
      <InstallationProcessProgressBar
        currentStep={ProcessStatus.INSTALLING}
      />,
    );
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('설치 진행 단계');
  });
});
