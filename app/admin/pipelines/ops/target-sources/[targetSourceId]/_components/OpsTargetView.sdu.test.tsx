// @vitest-environment jsdom
/**
 * SDU 게이트 — OpsTargetView 가 SDU 대상에서 **탭만** 거두고 마스트헤드는 세운다.
 *
 * 규칙이 바뀌었다. 예전에는 SDU 가 화면 전체를 안내 한 장으로 바꿨고, 그래서 부수
 * 로드 네 갈래가 전부 헛돈다는 것이 이 파일의 단언이었다. 이제 마스트헤드가 서므로
 * 그중 둘은 **읽는 사람이 있다** — 진행 상태는 「연동 대상」 머리 줄의 단계 알약이,
 * Jira 티켓은 「관련 페이지」 패널이 읽는다. 남은 둘(연결 테스트·AWS role)은 탭만
 * 읽으므로 여전히 돌면 안 된다. 규칙은 "SDU 냐"가 아니라 "그릴 사람이 있느냐"다.
 *
 * SduOpsNotice 자체를 재는 테스트로는 갈림길을 못 잡는다. 게이트를 통째로 지워도 그
 * 컴포넌트 테스트는 전부 green 이다 (실제로 확인했다). 여기서 재는 것은 셋이다:
 * 어느 대상에서 안내로 갈라지는가, 탭 줄이 마스트헤드를 따라 돌아오지 않는가,
 * 그리고 마스트헤드가 SDU 를 SDU 라고 말하는가.
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

// 부수 로드 네 갈래 — 어느 것이 마스트헤드의 입력이고 어느 것이 탭의 것인지가 아래
// 단언의 전부라, 스텁이 아니라 스파이로 잡아 둔다.
const getProcessStatus = vi.fn(async (): Promise<null> => null);
vi.mock('@/app/lib/api', () => ({
  getProcessStatus: () => getProcessStatus(),
}));
const getTargetJiraTicket = vi.fn(async (): Promise<null> => null);
// Now that a verdict is derived, this response is the screen — the route zod-parses it, so {} is the minimal shape.
const getAwsRoleVerification = vi.fn(async (): Promise<Record<string, never>> => ({}));
const getTestConnectionDetail = vi.fn(async (): Promise<null> => null);

vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({
  getAwsRoleVerification: () => getAwsRoleVerification(),
}));
vi.mock('@/app/lib/api/ops', () => ({
  getTargetJiraTicket: () => getTargetJiraTicket(),
  // 이 파일의 픽스처에는 §10 응답이 없다 — 뷰의 .catch 가 받아 헬스만 '확인 실패'로 선다.
  getDagStatus: vi.fn(() => Promise.reject(new Error('no dag-status fixture'))),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: () => getTestConnectionDetail(),
  getTestConnectionResults: vi.fn(async () => []),
}));

/**
 * effect 게이트가 어디까지 좁아졌는지 — 네 갈래를 모두 본다. 하나만 검사하면 그 하나가
 * 블록 첫 줄이라서 통과하는 것이고, 순서가 바뀌면 가드가 조용히 사라진다.
 *
 * 마스트헤드가 읽는 둘은 **불려야 한다**: 안 부르면 SDU 대상의 단계 알약과 관련 페이지가
 * 영원히 도착하지 않는데, 티켓 쪽은 스켈레톤이 계속 서 있어서 화면이 그 사실을 말하지도
 * 않는다. 탭만 읽는 둘은 여전히 불리면 안 된다 — 받아도 그릴 곳이 없다.
 */
const expectHeaderLoadsOnly = async (): Promise<void> => {
  await waitFor(() => expect(getProcessStatus).toHaveBeenCalled());
  await waitFor(() => expect(getTargetJiraTicket).toHaveBeenCalled());
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
  });

  it('마스트헤드는 선다 — 경로와 「환경」 셀이 이 대상을 SDU 라고 말한다', async () => {
    // 안내 한 장이던 시절에는 이 화면에 마스트헤드가 없었다. 이제 대상 식별은 전부
    // 마스트헤드가 지므로, 그것이 서지 않으면 안내만 남아 어느 대상인지 알 수 없다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" />);
    expect(await screen.findByText('#1099')).toBeTruthy();
    // IDC 「환경」 셀과 같은 문법이다 (OpsTargetView.idc.test.tsx) — 한 행이 셋 다 든다:
    // 키(환경) · 값(데이터 직접 업로드) · 태그(SDU).
    const env = await screen.findByText('데이터 직접 업로드');
    expect(env.parentElement?.textContent).toContain('환경');
    expect(env.parentElement?.textContent).toContain('SDU');
  });

  it('SDU 는 밑에 깔린 CSP 계정을 사실처럼 적지 않는다', async () => {
    // 픽스처의 cloud_provider 는 'AWS' 이고 계정 ID 도 있다 — 그 계정은 존재하지만
    // 우리가 설치하는 계정이 아니라, 격자에 적으면 이 화면의 어느 동작도 건드리지
    // 않는 값을 대조 가능한 사실처럼 말하게 된다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" />);
    await screen.findByText(NOTICE);
    expect(screen.queryByText('계정')).toBeNull();
    expect(screen.queryByText('210987654321')).toBeNull();
  });

  it('마스트헤드가 서도 탭 줄은 돌아오지 않는다', async () => {
    // 탭은 오지 않는 것이 결정이다. 마스트헤드를 세우면서 탭 줄까지 딸려 오면 아홉
    // 탭이 전부 빈 화면을 여는 버튼이 된다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" />);
    await screen.findByText(NOTICE);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
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

  it('SDU 경로에서는 탭이 제 요청을 쏘지 않는다 — 마스트헤드의 둘만 돈다', async () => {
    // 게이트를 detail 도착 직후에 둔 이유 — 탭이 마운트되면 각자 제 몫을 불러온다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" />);
    await screen.findByText(NOTICE);
    await expectHeaderLoadsOnly();
  });
});
