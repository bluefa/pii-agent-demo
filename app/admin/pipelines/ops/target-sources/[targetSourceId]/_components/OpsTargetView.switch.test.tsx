// @vitest-environment jsdom
/**
 * 대상이 바뀌면 앞 대상의 응답은 사실이 아니다.
 *
 * 언마운트 없이 `targetSourceId` 만 바뀌는 경로에서, 비우지 않으면 앞 대상의
 * 마스트헤드가 새 대상의 **정착된 사실**로 서 있다가 응답이 하나씩 도착하며 뒤집힌다.
 * 화면에 그런 링크가 아직 없어 잠복이지만, 이 파일이 그 상태를 관측 가능한 렌더로
 * 붙든다 — `renderHook` + `act` 로는 초기화가 있든 없든 같은 초록이 나온다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const ACCOUNT = '918273645500';

const getRawTargetSourceDetail = vi.fn((id: number | string) =>
  id === 1013
    ? Promise.resolve({
        target_source_id: 1013,
        service_name: 'AWS',
        service_code: 'aws',
        cloud_provider: 'AWS',
        metadata: { is_sdu_type: false, aws_account_id: ACCOUNT },
      })
    : // 새 대상의 상세는 오지 않는다 — 그 사이 화면이 무엇을 말하는지가 이 테스트다.
      new Promise(() => {}),
);

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (targetSourceId: number | string) => getRawTargetSourceDetail(targetSourceId),
}));
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: vi.fn(async () => ({ content: [], totalPages: 1 })),
  startScan: vi.fn(async () => null),
}));
vi.mock('@/app/lib/api', () => ({ getProcessStatus: vi.fn(async () => null) }));
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({ getAwsRoleVerification: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/ops', () => ({
  getCollaborationChannel: vi.fn(async () => null),
  getTargetJiraTicket: vi.fn(async () => null),
  updateTargetSourceDoesSupportRaw: vi.fn(async () => undefined),
  getDagStatus: vi.fn(() => Promise.reject(new Error('no dag-status fixture'))),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => null),
  getTestConnectionResults: vi.fn(async () => []),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1013');
});

describe('OpsTargetView — 대상 전환', () => {
  it('id 가 바뀌면 앞 대상의 마스트헤드가 남지 않는다', async () => {
    const { rerender, container } = render(
      <OpsTargetView targetSourceId={1013} initialTab="진행 상태" statusSlot={<div />} />,
    );
    // 앞 대상이 정착한 것을 먼저 확인한다 — 안 그리면 이 테스트는 아무것도 붙들지 않는다.
    expect(await screen.findByText(ACCOUNT)).toBeTruthy();

    rerender(<OpsTargetView targetSourceId={2222} initialTab="진행 상태" statusSlot={<div />} />);

    await waitFor(() => {
      expect(screen.queryByText(ACCOUNT)).toBeNull();
    });
    // 화면은 "모른다"로 돌아간다 — 셸 스켈레톤이 다시 선다.
    expect(container.querySelector('[aria-busy]')).not.toBeNull();
  });
});
