// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstallPendingNotice } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallPendingNotice';
import {
  installPendingGate,
  type InstallPendingResult,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import {
  installStateView,
  type InstallStateView,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installState';
import type {
  InstallDetailResource,
  InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1010' }));

const resource = (
  resourceId: string,
  cells: Record<string, InstallStepValue>,
): InstallDetailResource => ({
  resourceId,
  resourceName: `${resourceId}-name`,
  rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(
    Object.entries(cells).map(([key, status]) => [key, { status, guide: null }]),
  ),
});

const detailOf = (
  resources: readonly InstallDetailResource[],
  detail: { unavailable?: boolean } = {},
) => ({
  lastCheck: { status: 'SUCCESS' as const, checkedAt: '2026-08-31T01:00:00Z' },
  unavailable: detail.unavailable ?? false,
  resources,
});

/** The same two folds TcTab runs on one snapshot. */
const dataOf = (
  resources: readonly InstallDetailResource[],
  detail: { unavailable?: boolean } = {},
): { result: InstallPendingResult; view: InstallStateView | null } => ({
  result: installPendingGate({ provider: 'aws', manualInstall: true, detail: detailOf(resources, detail) }),
  view: installStateView({ provider: 'aws', manualInstall: true, detail: detailOf(resources, detail) }),
});

const TITLE = '설치가 끝나지 않아 연결 테스트가 실패합니다';

describe('InstallPendingNotice — the verdict note', () => {
  it('draws the step note under the sentence, link and all, exactly as the 인프라 작업 card does', () => {
    const azure = installStateView({
      provider: 'azure',
      manualInstall: false,
      detail: detailOf([resource('db-1', { vmSubnet: 'COMPLETED', vmApply: 'COMPLETED', bdc: 'COMPLETED', pe: 'IN_PROGRESS' })]),
    });
    const result = installPendingGate({
      provider: 'azure',
      manualInstall: false,
      detail: detailOf([resource('db-1', { vmSubnet: 'COMPLETED', vmApply: 'COMPLETED', bdc: 'COMPLETED', pe: 'IN_PROGRESS' })]),
    });
    render(<InstallPendingNotice data={{ result, view: azure }} onSelectTab={vi.fn()} />);

    expect(screen.getByText('서비스 담당자가 Private Endpoint 연결을 승인해야 합니다')).toBeTruthy();
    expect(screen.getByText('BDC측이 Terraform으로 Private Endpoint 연결 요청을 보냈습니다.')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Azure Portal에서 승인/ });
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('a GCP subnet turn names no command block here — this tab has none', () => {
    const gcp = installStateView({
      provider: 'gcp',
      manualInstall: false,
      detail: detailOf([resource('db-1', { subnet: 'IN_PROGRESS', service: 'IN_PROGRESS', bdc: 'IN_PROGRESS' })]),
    });
    const result = installPendingGate({
      provider: 'gcp',
      manualInstall: false,
      detail: detailOf([resource('db-1', { subnet: 'IN_PROGRESS', service: 'IN_PROGRESS', bdc: 'IN_PROGRESS' })]),
    });
    render(<InstallPendingNotice data={{ result, view: gcp }} onSelectTab={vi.fn()} />);

    expect(screen.getByText('서비스 담당자가 호스트 프로젝트에서 PSC용 Proxy Subnet을 만들어야 합니다.')).toBeTruthy();
    expect(screen.queryByText(/아래 명령/)).toBeNull();
  });
});

describe('InstallPendingNotice', () => {
  it('needed 일 때만 그린다 — done·unknown·없음은 아무것도 말하지 않는다', () => {
    const { unmount } = render(<InstallPendingNotice data={null} onSelectTab={vi.fn()} />);
    expect(screen.queryByText(TITLE)).toBeNull();
    unmount();

    const done = render(
      <InstallPendingNotice
        data={dataOf([resource('rds-1', { service: 'COMPLETED' })])}
        onSelectTab={vi.fn()}
      />,
    );
    expect(screen.queryByText(TITLE)).toBeNull();
    done.unmount();

    // unavailable = 「못 읽었다」. 읽지 못한 것을 근거로 실패를 예고하지 않는다.
    render(
      <InstallPendingNotice
        data={dataOf([resource('rds-1', { service: 'IN_PROGRESS' })], { unavailable: true })}
        onSelectTab={vi.fn()}
      />,
    );
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('상자 안의 답은 인프라 작업 탭과 같은 한 줄이다 — 누가 무엇을 할 차례인지', () => {
    render(
      <InstallPendingNotice
        data={dataOf([
          resource('rds-1', { service: 'IN_PROGRESS', bdcCommon: 'IN_PROGRESS' }),
          resource('rds-2', { service: 'COMPLETED', bdcCommon: 'IN_PROGRESS' }),
        ])}
        onSelectTab={vi.fn()}
      />,
    );

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText('서비스 담당자가 Terraform을 직접 적용해야 합니다')).toBeTruthy();
    expect(screen.getByText('서비스 조치 필요')).toBeTruthy();
    // The count and the resource-list modal are gone: the list lives in the other tab.
    expect(screen.queryByText(/건/)).toBeNull();
    expect(screen.queryByRole('button', { name: /미완료 리소스 보기/ })).toBeNull();
  });

  it('링크가 인프라 작업 탭을 연다', () => {
    const onSelectTab = vi.fn();
    render(
      <InstallPendingNotice
        data={dataOf([resource('rds-1', { service: 'COMPLETED', bdcCommon: 'IN_PROGRESS' })])}
        onSelectTab={onSelectTab}
      />,
    );

    expect(screen.getByText('관리자가 Terraform을 적용할 차례입니다')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /인프라 작업 탭에서 설치 상태 보기/ }));
    expect(onSelectTab).toHaveBeenCalledWith('인프라 작업');
  });
});
