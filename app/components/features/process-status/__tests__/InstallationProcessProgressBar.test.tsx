// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ProcessStatus } from '@/lib/types';
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
