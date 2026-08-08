// @vitest-environment jsdom
/**
 * SDU 게이트 — OpsTargetView 가 SDU 대상에서 탭 화면 대신 안내를 낸다.
 *
 * SduOpsNotice 자체를 재는 테스트로는 이걸 못 잡는다. 게이트를 통째로 지워도 그 컴포넌트
 * 테스트는 전부 green 이다 (실제로 확인했다). 여기서 재는 것은 "어느 대상에서 안내로
 * 갈라지는가" 하나다.
 *
 * 계약이 SDU 를 말하는 자리는 둘이다 — `metadata.is_sdu_type` 과 `cloudProvider` enum 의
 * `SDU`. 한쪽만 보면 그 경로로 오는 대상이 탭 화면으로 떨어지고, 거기서 각 탭이 제
 * 요청을 쏘고 나서야 할 말이 없다는 것을 알게 된다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const getRawTargetSourceDetail = vi.fn();

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));

// 게이트 뒤편(탭)이 부수적으로 쏘는 요청들 — 게이트가 열렸을 때만 도는지 보기 위해
// 전부 잡아 둔다. SDU 경로에서는 하나도 불리면 안 된다.
const getProcessStatus = vi.fn(async (): Promise<null> => null);
vi.mock('@/app/lib/api', () => ({
  getProcessStatus: () => getProcessStatus(),
}));
const getCollaborationChannel = vi.fn(async (): Promise<null> => null);
const getAwsRoleVerification = vi.fn(async (): Promise<null> => null);
const getTestConnectionDetail = vi.fn(async (): Promise<null> => null);

vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({
  getAwsRoleVerification: () => getAwsRoleVerification(),
}));
vi.mock('@/app/lib/api/ops', () => ({
  getCollaborationChannel: () => getCollaborationChannel(),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: () => getTestConnectionDetail(),
  getTestConnectionResults: vi.fn(async () => []),
}));

/** effect 가 SDU 에서 멈췄는지 — 네 갈래를 모두 본다. 하나만 검사하면 그 하나가
 *  블록 첫 줄이라서 통과하는 것이고, 순서가 바뀌면 가드가 조용히 사라진다. */
const expectNoSecondaryLoads = (): void => {
  expect(getProcessStatus).not.toHaveBeenCalled();
  expect(getCollaborationChannel).not.toHaveBeenCalled();
  expect(getAwsRoleVerification).not.toHaveBeenCalled();
  expect(getTestConnectionDetail).not.toHaveBeenCalled();
};

const detail = (over: Record<string, unknown> = {}) => ({
  target_source_id: 1099,
  service_name: 'SDU',
  service_code: 'SDU',
  cloud_provider: 'AWS',
  metadata: { is_sdu_type: true, aws_account_id: '210987654321', is_china_region: true },
  ...over,
});

const NOTICE = '운영 화면을 준비하고 있습니다';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpsTargetView — SDU 게이트', () => {
  it('metadata.is_sdu_type 이면 안내로 간다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" />);
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  it('cloudProvider 가 SDU 로 와도 안내로 간다 (플래그가 없어도)', async () => {
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ cloud_provider: 'SDU', metadata: { is_sdu_type: false } }),
    );
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" />);
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    // 렌더 게이트만으로도 안내는 뜬다 — effect 게이트가 이 갈래에서도 도는지 함께 본다.
    expectNoSecondaryLoads();
  });

  it('SDU 가 아니면 안내가 아니라 탭 화면이다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(
      detail({
        target_source_id: 1006,
        service_name: 'AWS',
        service_code: 'aws',
        metadata: { is_sdu_type: false, aws_account_id: '451814760281' },
      }),
    );
    render(<OpsTargetView targetSourceId={1006} initialTab="진행 상태" />);
    await waitFor(() => expect(getRawTargetSourceDetail).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(NOTICE)).toBeNull());
    expect(screen.getByText('진행 상태')).toBeTruthy();
  });

  it('SDU 경로에서는 탭이 제 요청을 쏘지 않는다', async () => {
    // 게이트를 detail 도착 직후에 둔 이유 — 탭이 마운트되면 각자 제 몫을 불러온다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" />);
    await screen.findByText(NOTICE);
    expectNoSecondaryLoads();
  });
});
