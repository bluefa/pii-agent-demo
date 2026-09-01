// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstallPendingNotice } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallPendingNotice';
import {
  installPendingGate,
  type InstallPendingResult,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type {
  InstallDetailResource,
  InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1010' }));

const resource = (
  resourceId: string,
  cells: Record<string, InstallStepValue>,
  guide: string | null = null,
): InstallDetailResource => ({
  resourceId,
  resourceName: `${resourceId}-name`,
  rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(
    Object.entries(cells).map(([key, status]) => [key, { status, guide }]),
  ),
});

const gateOf = (
  resources: readonly InstallDetailResource[],
  detail: { unavailable?: boolean } = {},
): InstallPendingResult =>
  installPendingGate({
    provider: 'aws',
    manualInstall: true,
    detail: {
      lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
      unavailable: detail.unavailable ?? false,
      resources,
    },
  });

const renderNotice = (result: InstallPendingResult): void => {
  render(
    <InstallPendingNotice
      data={{ result, lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' } }}
    />,
  );
};

const TITLE = '설치가 끝나지 않아 연결 테스트가 실패합니다';

describe('InstallPendingNotice', () => {
  it('needed 일 때만 그린다 — done·unknown·없음은 아무것도 말하지 않는다', () => {
    const { unmount } = render(<InstallPendingNotice data={null} />);
    expect(screen.queryByText(TITLE)).toBeNull();
    unmount();

    const done = render(
      <InstallPendingNotice
        data={{ result: gateOf([resource('rds-1', { service: 'COMPLETED' })]), lastCheck: null }}
      />,
    );
    expect(screen.queryByText(TITLE)).toBeNull();
    done.unmount();

    // unavailable = 「못 읽었다」. 읽지 못한 것을 근거로 실패를 예고하지 않는다.
    render(
      <InstallPendingNotice
        data={{
          result: gateOf([resource('rds-1', { service: 'IN_PROGRESS' })], { unavailable: true }),
          lastCheck: null,
        }}
      />,
    );
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('세는 것은 리소스다 — 한 리소스의 안 끝난 셀이 둘이어도 1건이다', () => {
    renderNotice(
      gateOf([
        resource('rds-1', { service: 'IN_PROGRESS', bdcService: 'UNKNOWN' }),
        resource('rds-2', { service: 'COMPLETED', bdcService: 'COMPLETED' }),
      ]),
    );

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText('1건')).toBeTruthy();
    expect(screen.getByText(/지금 실행하면 해당 리소스는 연결에 실패합니다/)).toBeTruthy();
  });

  it('링크가 모달을 열고, 표는 셀 하나에 행 하나를 세운다', () => {
    renderNotice(
      gateOf([
        resource('rds-1', { service: 'IN_PROGRESS', bdcCommon: 'FAIL' }, '적용에 실패했습니다.'),
        resource('rds-2', { service: 'COMPLETED' }),
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: /미완료 리소스 보기/ }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('설치가 끝나지 않은 리소스')).toBeTruthy();
    // 같은 리소스가 두 단계에서 걸렸으므로 이름이 두 행에 선다.
    expect(within(dialog).getAllByText('rds-1-name')).toHaveLength(2);
    // 끝난 리소스는 이 목록의 것이 아니다.
    expect(within(dialog).queryByText('rds-2-name')).toBeNull();
    // 단계 열이 선다 — 이 표가 답하는 것은 「어느 리소스의 어느 단계인가」다.
    expect(within(dialog).getByText('설치 단계')).toBeTruthy();
    expect(within(dialog).getByText('서비스 측 Terraform 적용')).toBeTruthy();
    expect(within(dialog).getByText('BDC 공통 영역')).toBeTruthy();
    // 상태 낱말은 이 콘솔의 것이다.
    expect(within(dialog).getByText('작업필요')).toBeTruthy();
    expect(within(dialog).getByText('조회실패')).toBeTruthy();
    expect(within(dialog).getByText('마지막 확인시간 26.08.31 10:00')).toBeTruthy();
  });

  it('닫기가 모달을 닫는다', () => {
    renderNotice(gateOf([resource('rds-1', { service: 'IN_PROGRESS' })]));

    fireEvent.click(screen.getByRole('button', { name: /미완료 리소스 보기/ }));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
