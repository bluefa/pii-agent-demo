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
   * step LAYOUTS own, not this component. Today: the stepper's own `pb-[18px]` plus
   * the body column's `pt-8` give 50px, and the tag needs 32px (`mt-1.5` + ~26px
   * tall), leaving 18px of clearance to the first card.
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
