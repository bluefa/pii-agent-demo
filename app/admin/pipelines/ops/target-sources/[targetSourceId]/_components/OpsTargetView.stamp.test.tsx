// @vitest-environment jsdom
/**
 * 상세 홉: `TargetSourceDetail` 의 **snake** 키가 헤더의 도장까지 살아 있는지.
 *
 * 계약은 같은 값을 목록 응답엔 camel(`piiAgentFirstInstalledAt`), 상세 응답엔
 * snake(`pii_agent_first_installed_at`) 로 싣는다 — `supportRawData` 와 같은 자리의
 * 함정이다. 이 홉이 어긋나면 에러도 빈 화면도 없이 **도장이 한 번도 안 찍힌다**.
 * 목록 홉은 라우트 테스트가 잡고 있어서, 남는 자리가 여기였다.
 */
import { render, screen } from '@testing-library/react';
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

const STAMP_LABEL = '최초 1회 연동 완료';

const detail = (over: Record<string, unknown> = {}) => ({
  target_source_id: 1013,
  service_name: 'Azure',
  service_code: 'azure',
  cloud_provider: 'AZURE',
  metadata: { is_sdu_type: false },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1013');
});

describe('OpsTargetView — 최초 연동 도장', () => {
  it('상세 응답의 snake 키를 읽어 날짜까지 찍는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ pii_agent_first_installed_at: '2026-02-01T05:00:00Z' }),
    );
    render(<OpsTargetView targetSourceId={1013} initialTab="진행 상태" />);

    expect(await screen.findByText(STAMP_LABEL)).toBeTruthy();
    // 서울 기준 날짜. 값이 헤더까지 온 것만이 아니라 **그 값**이 온 것을 확인한다.
    expect(screen.getByText('2026-02-01')).toBeTruthy();
  });

  it('camel 로 오면 안 찍힌다 — 상세 응답의 철자는 snake 하나뿐이다', async () => {
    // 이 테스트가 하는 일: 리더가 두 철자를 다 읽도록 "고치는" 변경을 막는다. 두
    // 철자를 다 읽으면 계약이 둘 다 허용한다고 말하는 셈이라, 어느 쪽이 진짜 서버가
    // 보낸 값인지 화면에서 알 수 없게 된다.
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ piiAgentFirstInstalledAt: '2026-02-01T05:00:00Z' }),
    );
    render(<OpsTargetView targetSourceId={1013} initialTab="진행 상태" />);

    // 헤더가 다 그려질 때까지 기다린 뒤에 판정한다 — 도장이 늦게 오는 것과 아예
    // 안 오는 것을 구분하기 위해서다.
    await screen.findByTitle('실데이터 여부 변경');
    expect(screen.queryByText(STAMP_LABEL)).toBeNull();
  });

  it('값이 없으면 침묵한다 — "미완료"라고 쓰지 않는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1013} initialTab="진행 상태" />);

    // 헤더가 다 그려질 때까지 기다린 뒤에 판정한다 — 도장이 늦게 오는 것과 아예
    // 안 오는 것을 구분하기 위해서다.
    await screen.findByTitle('실데이터 여부 변경');
    expect(screen.queryByText(STAMP_LABEL)).toBeNull();
  });
});
