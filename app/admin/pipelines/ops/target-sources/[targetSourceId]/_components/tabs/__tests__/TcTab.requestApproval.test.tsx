// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { TcTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcTab';

/**
 * 관리자의 「승인 요청」 배선 — 순수 함수 테스트가 못 보는 자리. 판정(`stepHoldView`)이
 * 옳게 `canRequest` 를 내도 TcTab 이 그 버튼을 PUT 에 안 잇거나 성공 뒤 단계를 다시 안
 * 읽으면 화면은 5단계에 그대로 서 있다. 그래서 여기서는 **`updateTestConnectionConfirmation`
 * 이 confirmed:true 로 불렸는가**와 **`onAcknowledged` 가 뒤따르는가**를 본다.
 */

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1010' }));

const updateTestConnectionConfirmation = vi.fn().mockResolvedValue({ target_source_id: 1010 });
// 서비스 Step 5 의 게이트 그대로 — completion-status 가 열어 줘야 버튼이 열린다.
const getTestConnectionCompletionStatus = vi
  .fn()
  .mockResolvedValue({ test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS' });

vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: vi.fn(async () => ({
    resource_infos: [
      {
        resource_id: 'r-1',
        resource_name: 'db-1',
        database_type: 'mysql',
        database_region: 'ap-northeast-2',
        credential_id: 7,
      },
    ],
  })),
  getSecrets: vi.fn().mockResolvedValue([]),
  triggerTestConnection: vi.fn(),
  updateTestConnectionConfirmation: (...args: unknown[]) => updateTestConnectionConfirmation(...args),
  getTestConnectionCompletionStatus: (...args: unknown[]) => getTestConnectionCompletionStatus(...args),
}));

vi.mock('@/app/lib/api/task-queue-requests', () => ({
  getApprovalRequestLatest: vi.fn().mockRejectedValue(new Error('no request')),
}));

vi.mock(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard',
  () => ({ ConfirmedInfoCard: () => null }),
);

vi.mock('@/app/admin/pipelines/_components/usePlToast', () => ({
  usePlToast: () => ({ show: vi.fn() }),
}));

// 설치 상태는 이 테스트의 관심 밖 — 예보가 서지 않게 정착한 상태로 답한다.
vi.mock('@/app/lib/api/aws', () => ({
  getAwsInstallationStatus: vi.fn().mockResolvedValue({
    lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
    resources: [],
  }),
}));

const latest: TestConnectionVersionResult = {
  target_source_id: 1010,
  test_connection_version: 2,
  connection_status: 'SUCCESS',
  requested_at: '2026-06-01T00:00:00Z',
  completed_at: '2026-06-01T00:01:00Z',
  test_connection_agent_results: [{ agent_id: 'a', resource_id: 'r-1', connection_status: 'SUCCESS' }],
};

describe('TcTab — 관리자의 승인 요청', () => {
  it('확인 모달의 「요청」이 PUT confirmed:true 를 보내고, 성공하면 상태와 단계를 다시 읽는다', async () => {
    const onStatusReload = vi.fn();
    const onAcknowledged = vi.fn();
    render(
      <TcTab
        targetSourceId={1010}
        isIdc={false}
        provider="aws"
        manualInstall={false}
        latest={latest}
        results={[]}
        statusLoaded
        latestFailed={false}
        processStatus="INSTALLED"
        tcStatus={null}
        tcStatusFailed={false}
        onStatusReload={onStatusReload}
        onAcknowledged={onAcknowledged}
      />,
    );

    // 성공 + 전부 연결 + completion OK + 미요청 → 버튼이 열린다(completion 이 오기 전엔 잠시 닫힘).
    await waitFor(() => expect(getTestConnectionCompletionStatus).toHaveBeenCalledWith(1010));
    const open = await screen.findByRole('button', { name: '승인 요청' });
    await waitFor(() => expect(open.hasAttribute('disabled')).toBe(false));
    fireEvent.click(open);
    expect(updateTestConnectionConfirmation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '요청' }));
    await waitFor(() => expect(updateTestConnectionConfirmation).toHaveBeenCalledWith(1010, true));
    await waitFor(() => expect(onAcknowledged).toHaveBeenCalledTimes(1));
    expect(onStatusReload).toHaveBeenCalled();
  });
});
