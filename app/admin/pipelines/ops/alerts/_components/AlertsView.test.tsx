// @vitest-environment jsdom
/**
 * 운영 알림 타일은 강조가 아니라 **필터**다 (docs/ux/benchmark/ops-alerts-worklist.md).
 * 여기서 박아 두는 축: ① 요약이 오면 건수 있는 첫 버킷이 기본 선택되고 그 버킷만
 * 불러온다(항상 하나 선택) ② 타일 클릭이 목록을 실제로 갈아끼운다 ③ 선택 타일을
 * 다시 눌러도 해제되지 않는다 ④ 행 활성화는 Target Source 운영 화면으로 간다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AlertListRow, DashboardSummary, Paged } from '@/lib/types/task-queue';
import { passRoutes } from '@/lib/routes';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const api = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getAlertTargetSources: vi.fn(),
}));
vi.mock('@/app/lib/api/task-queue', () => api);

import { AlertsView } from '@/app/admin/pipelines/ops/alerts/_components/AlertsView';

const SUMMARY: DashboardSummary = {
  pendingApprovalCount: 0,
  rejectedApprovalCount: 0,
  testConnectionCompletedCount: 0,
  testConnectionRejectionCount: 0,
  confirmingCount: 0,
  needInstallCount: 2,
  needTestConnectionCount: 1,
  needPiiAgentConfirmCount: 0,
  evaluatedAt: null,
};

const ROW: AlertListRow = {
  targetSourceId: 1861,
  serviceName: '정산서비스',
  description: '정산 마감 배치 RDS',
  serviceCode: 'STL',
  cloudProvider: 'AWS',
  confirmStatus: 'CONFIRMED',
  latestApprovalRequest: null,
  delaySeconds: 262000,
  statusChangedAt: '2026-07-17T18:56:00Z',
};

const page = (content: AlertListRow[]): Paged<AlertListRow> => ({
  content,
  totalElements: content.length,
  totalPages: 1,
  number: 0,
  size: 10,
  first: true,
  last: true,
  numberOfElements: content.length,
  empty: content.length === 0,
});

const tile = (name: RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  api.getDashboardSummary.mockResolvedValue(SUMMARY);
  api.getAlertTargetSources.mockResolvedValue(page([ROW]));
});

describe('AlertsView — 타일이 곧 필터', () => {
  it('요약이 오면 건수 있는 첫 버킷(프로세스 순서)이 기본 선택되고 그 버킷만 불러온다', async () => {
    render(<AlertsView />);
    // confirming 은 0건이라 건너뛰고 need-install 이 기본이 된다.
    await waitFor(() =>
      expect(api.getAlertTargetSources).toHaveBeenCalledWith(
        'need-install',
        0,
        10,
        expect.anything(),
      ),
    );
    expect(tile(/설치 필요/).getAttribute('aria-pressed')).toBe('true');
    expect(tile(/리소스 확정 진행 중/).getAttribute('aria-pressed')).toBe('false');
  });

  it('행은 pipelines 대상 문법으로 그려지고, 활성화하면 운영 화면으로 간다', async () => {
    render(<AlertsView />);
    await waitFor(() => expect(screen.getByText('정산서비스')).toBeDefined());
    // TargetCell: Target 번호 · 코드 값 · 서비스 이름, 그리고 설명 열.
    expect(screen.getByText('1861')).toBeDefined();
    expect(screen.getByText('STL')).toBeDefined();
    expect(screen.getByText('정산 마감 배치 RDS')).toBeDefined();
    // Proposed field delay_seconds, humanized by the monitor's DelayText.
    expect(screen.getByText('3일')).toBeDefined();

    fireEvent.click(screen.getByText('정산서비스').closest('tr') as HTMLElement);
    expect(push).toHaveBeenCalledWith(passRoutes.pipelines.ops.targetSource('1861'));
  });

  it('다른 타일을 누르면 그 버킷으로 목록이 갈아끼워진다', async () => {
    render(<AlertsView />);
    await waitFor(() => expect(api.getAlertTargetSources).toHaveBeenCalled());

    fireEvent.click(tile(/연결 테스트 필요/));
    await waitFor(() =>
      expect(api.getAlertTargetSources).toHaveBeenCalledWith(
        'need-test-connection',
        0,
        10,
        expect.anything(),
      ),
    );
    expect(tile(/연결 테스트 필요/).getAttribute('aria-pressed')).toBe('true');
    expect(tile(/설치 필요/).getAttribute('aria-pressed')).toBe('false');
  });

  it('선택된 타일을 다시 눌러도 해제되지 않는다 — 항상 하나가 선택', async () => {
    render(<AlertsView />);
    await waitFor(() => expect(api.getAlertTargetSources).toHaveBeenCalled());

    fireEvent.click(tile(/설치 필요/));
    expect(tile(/설치 필요/).getAttribute('aria-pressed')).toBe('true');
  });
});
