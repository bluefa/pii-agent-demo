// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstallPendingNotice, INSTALL_CHECK_TOOLTIP, type InstallPendingNoticeData } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallPendingNotice';
import { installPendingGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import { buildInstallTasks } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installTasks';
import type { InstallDetailResource, InstallStepValue } from '@/app/components/features/process-status/install-status-detail/model';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1010' }));

const resource = (resourceId: string, cells: Record<string, InstallStepValue>): InstallDetailResource => ({
  resourceId, resourceName: resourceId + '-name', rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(Object.entries(cells).map(([key, status]) => [key, { status, guide: '상세 설치 안내' }])),
});

const noticeData = (resources: InstallDetailResource[], provider = 'aws', manualInstall = true): InstallPendingNoticeData => {
  const lastCheck = { status: 'SUCCESS' as const, checkedAt: '2026-08-31T01:00:00Z' };
  const input = { provider, manualInstall, detail: { lastCheck, unavailable: false, resources } };
  return {
    result: installPendingGate(input), tasks: buildInstallTasks(input),
    lastCheck, targetSourceId: 1010, provider, manualInstall,
  };
};

describe('InstallPendingNotice', () => {
  it('shows only the skeleton until loading settles, even with a prior completed snapshot', () => {
    const data = noticeData([resource('db', { service: 'COMPLETED' })]);
    const { rerender } = render(<InstallPendingNotice data={data} loading />);
    expect(screen.getByRole('region', { name: '설치 정보 조회 중' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('설치가 완료되었습니다.')).toBeNull();
    expect(screen.queryByText('마지막 확인')).toBeNull();
    rerender(<InstallPendingNotice data={data} loading={false} />);
    expect(screen.queryByRole('region', { name: '설치 정보 조회 중' })).toBeNull();
    expect(screen.getByText('설치가 완료되었습니다.')).toBeTruthy();
  });

  it('does not claim readiness when installation status is absent or unknown', () => {
    const { rerender } = render(<InstallPendingNotice data={null} />);
    expect(screen.queryByRole('region', { name: '설치 현황' })).toBeNull();
    rerender(<InstallPendingNotice data={noticeData([])} />);
    expect(screen.queryByRole('region', { name: '설치 현황' })).toBeNull();
  });

  it.each(['aws', 'azure', 'gcp', 'idc'])('keeps the completion message and check timestamp for %s', provider => {
    render(<InstallPendingNotice data={noticeData([resource('db', { service: 'COMPLETED' })], provider)} />);
    expect(screen.getByRole('region', { name: '설치 현황' })).toBeTruthy();
    expect(screen.getByText('설치가 완료되었습니다.')).toBeTruthy();
    expect(screen.getByText('26. 08. 31. 10:00')).toBeTruthy();
    expect(screen.queryByText(/미완료 대상/)).toBeNull();
    expect(screen.queryByText('서비스 담당자')).toBeNull();
  });

  it('identifies the executor and waiting party without predicting an error in the title', () => {
    render(<InstallPendingNotice data={noticeData([
      resource('rds-1', { service: 'IN_PROGRESS', bdcCommon: 'BDC_INSTALL_REQUIRED' }),
      resource('rds-2', { service: 'COMPLETED', bdcCommon: 'COMPLETED' }),
    ])} />);
    expect(screen.getByText('연결 테스트 전 준비 사항')).toBeTruthy();
    expect(screen.getByText('AWS · 수동 설치')).toBeTruthy();
    expect(screen.getByText('서비스 담당자')).toBeTruthy();
    expect(screen.getByText('BDC 담당자')).toBeTruthy();
    expect(screen.getByText('서비스 작업 대기')).toBeTruthy();
    expect(screen.queryByText('설치가 끝나지 않아 연결 테스트가 실패합니다')).toBeNull();
    expect(screen.getByText('마지막 확인')).toBeTruthy();
  });

  it('opens the selected task resources and closes the modal', () => {
    render(<InstallPendingNotice data={noticeData([
      resource('rds-1', { service: 'COMPLETED', bdcCommon: 'IN_PROGRESS', bdcService: 'FAIL' }),
      resource('rds-2', { service: 'COMPLETED', bdcCommon: 'COMPLETED', bdcService: 'COMPLETED' }),
    ])} />);
    fireEvent.click(screen.getByRole('button', { name: /대상 리소스 및 작업 보기 · 1건/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('BDC 측 후속 설치')).toBeTruthy();
    expect(within(dialog).getAllByText('rds-1-name')).toHaveLength(2);
    expect(within(dialog).queryByText('rds-2-name')).toBeNull();
    expect(within(dialog).getByText('BDC 공통 영역')).toBeTruthy();
    expect(within(dialog).getByText('마지막 확인시간 26.08.31 10:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('links ready BDC work to the infrastructure tab', () => {
    render(<InstallPendingNotice data={noticeData([resource('db', { service: 'IN_PROGRESS' })], 'aws', false)} />);
    expect(screen.getByRole('link', { name: /인프라 작업 보기/ }).getAttribute('href')).toContain('/1010?tab=infra');
    expect(screen.getByText('AWS · 자동 설치')).toBeTruthy();
    expect(screen.queryByText('서비스 담당자')).toBeNull();
  });

  it('explains snapshot freshness on keyboard focus without claiming hourly polling', async () => {
    render(<InstallPendingNotice data={noticeData([resource('db', { service: 'COMPLETED' })])} />);
    expect(screen.queryByText(INSTALL_CHECK_TOOLTIP)).toBeNull();
    await act(async () => {
      fireEvent.focus(screen.getByRole('button', { name: '마지막 설치 상태 확인 시간 및 조회 주기' }));
    });
    expect(screen.getByText(INSTALL_CHECK_TOOLTIP)).toBeTruthy();
    expect(INSTALL_CHECK_TOOLTIP).toContain('실시간으로 조회하지 않습니다');
    expect(INSTALL_CHECK_TOOLTIP).not.toContain('1시간마다');
  });

  it('does not fabricate a timestamp when the server did not supply one', () => {
    const data = noticeData([resource('db', { service: 'COMPLETED' })]);
    render(<InstallPendingNotice data={{ ...data, lastCheck: null }} />);
    expect(screen.getByText('확인 기록 없음')).toBeTruthy();
    expect(screen.queryByText('26. 08. 31. 10:00')).toBeNull();
  });
});
