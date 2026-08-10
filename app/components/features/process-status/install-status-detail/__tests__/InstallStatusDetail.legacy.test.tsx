// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallStatusDetail } from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import type {
  InstallDetailResource,
  InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';

/**
 * Legacy-layout guard. Azure / GCP / IDC adapters declare no rail groups and
 * have no component tests of their own, while the AWS suite now exercises only
 * the grouped branch — these cases pin the legacy render (summary step, side
 * text, n/m counts) so shared-code refactors cannot silently change it.
 */

const cell = (status: InstallDetailResource['rollup']['status'], guide: string | null = null) => ({
  status,
  guide,
});

const steps = (withGroupOnFirst = false): InstallTableStep[] => [
  {
    id: 'service',
    title: '서비스 측 구성',
    side: '서비스측 리소스 생성',
    desc: '서비스 측 리소스를 구성합니다.',
    ...(withGroupOnFirst ? { group: 'todo' as const } : {}),
  },
  {
    id: 'bdc',
    title: 'BDC 구성',
    side: 'BDC측 리소스 생성',
    desc: 'BDC 측 리소스를 구성합니다.',
  },
];

const resources: InstallDetailResource[] = [
  {
    resourceId: 'r-1',
    resourceName: null,
    rollup: cell('COMPLETED'),
    cells: { service: cell('COMPLETED'), bdc: cell('COMPLETED') },
  },
  {
    resourceId: 'r-2',
    resourceName: null,
    rollup: cell('FAIL'),
    cells: { service: cell('FAIL', '서브넷 IP 부족'), bdc: cell('BDC_INSTALL_REQUIRED') },
  },
];

const renderDetail = (stepList: InstallTableStep[]) =>
  render(
    <InstallStatusDetail
      lastCheck={{ status: 'SUCCESS', checkedAt: '2026-07-29T14:02:00Z' }}
      resources={resources}
      steps={stepList}
      meta={new Map()}
    />,
  );

describe('InstallStatusDetail — legacy (ungrouped) layout', () => {
  it('keeps the summary step, side text and n/m counts for group-less adapters', () => {
    renderDetail(steps());

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).getByText('설치 현황 요약')).toBeTruthy();
    // Per-item side text stays in the legacy rail.
    expect(within(nav).getAllByText(/서비스측/).length).toBeGreaterThanOrEqual(1);
    // Settled/total count next to the status word (r-1 settled of 2, per step).
    expect(within(nav).getAllByText('1/2').length).toBeGreaterThanOrEqual(1);
    // No grouped-mode chrome.
    expect(screen.queryByText(/내가 할 일/)).toBeNull();
  });

  it('falls back to the legacy layout for a half-migrated adapter (partial group declarations)', () => {
    renderDetail(steps(true));

    // With one step grouped and one not, the grouped rail would drop the
    // ungrouped step from the nav entirely — the fallback keeps every step reachable.
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).getByText('설치 현황 요약')).toBeTruthy();
    expect(within(nav).getByText('서비스 측 구성')).toBeTruthy();
    expect(within(nav).getByText('BDC 구성')).toBeTruthy();
    expect(screen.queryByText(/내가 할 일/)).toBeNull();
  });
});
