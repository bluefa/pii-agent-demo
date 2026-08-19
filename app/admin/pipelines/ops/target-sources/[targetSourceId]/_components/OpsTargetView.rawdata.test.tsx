// @vitest-environment jsdom
/**
 * 실데이터 칩의 세 상태 (docs/api/ops-assumed-contracts.md — 필드 노트).
 *
 * 이 화면이 서비스 운영 카드와 갈리는 지점이 여기다: 카드는 `=== true` 로 접어서 태그를
 * 그리거나 말거나 하지만, 이 헤더는 값을 **바꾸는** 자리라 못 읽은 값을 "미포함" 이라고
 * 쓰면 안 된다. 그 구분은 라벨 삼항 한 줄에만 살아 있어서, 두 상태로 되접어도 다른
 * 테스트는 전부 초록이다 — 실제로 그렇게 확인했다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const getRawTargetSourceDetail = vi.fn();

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
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
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => null),
  getTestConnectionResults: vi.fn(async () => []),
}));

const detail = (over: Record<string, unknown> = {}) => ({
  target_source_id: 1013,
  service_name: 'Azure',
  service_code: 'azure',
  cloud_provider: 'AZURE',
  metadata: { is_sdu_type: false },
  ...over,
});

const chip = async (): Promise<string> => {
  const button = await screen.findByTitle('실데이터 여부 변경');
  await waitFor(() => expect(button.textContent).toBeTruthy());
  return button.textContent ?? '';
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1013');
});

describe('OpsTargetView — 실데이터 칩', () => {
  it('true 는 포함', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ supportRawData: true }));
    render(<OpsTargetView targetSourceId={1013} initialTab="진행 상태" />);
    expect(await chip()).toBe('포함');
  });

  it('false 는 미포함', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ supportRawData: false }));
    render(<OpsTargetView targetSourceId={1013} initialTab="진행 상태" />);
    expect(await chip()).toBe('미포함');
  });

  it('값이 없으면 미확인 — 미포함이 아니다', async () => {
    // 계약 반영 전 실서버가 이 모양이다. 여기서 "미포함" 이 나오면 화면이 받은 적 없는
    // 사실을 말하는 것이고, 운영자는 그걸 확인된 값으로 읽는다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1013} initialTab="진행 상태" />);
    expect(await chip()).toBe('미확인');
  });

  it('boolean 이 아닌 값도 미확인이다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ supportRawData: 'true' }));
    render(<OpsTargetView targetSourceId={1013} initialTab="진행 상태" />);
    expect(await chip()).toBe('미확인');
  });
});
