// @vitest-environment jsdom
/**
 * 「상세 정보」 접힘 안의 설명 (design-benchmark `ops-target-frontmeta.md`, 시안 C).
 *
 * 236px 레일이 지던 자리다. 레일은 폭이 없어 표시를 100자에서 접었고, 3열 접힘은 그
 * 제약이 없어 전문을 편다 — 그래서 이 파일이 검사하는 것도 바뀐다: 접기 상수 대신
 * **디스클로저 게이트**(열기 전에는 화면에 없다)와 **접지 않음**(140자도 그대로).
 * 저장-후-갱신 트립와이어는 그대로다: 저장이 로컬 detail 을 안 덮어도 다른 테스트는
 * 전부 초록이다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const getRawTargetSourceDetail = vi.fn();
const updateTargetSourceDescription =
  vi.fn<(id: number, description: string) => Promise<void>>(async () => undefined);

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: vi.fn(async () => ({ content: [], totalPages: 1 })),
  startScan: vi.fn(async () => null),
}));
vi.mock('@/app/lib/api', () => ({
  getProcessStatus: vi.fn(async () => null),
  updateTargetSourceDescription: (id: number, description: string) =>
    updateTargetSourceDescription(id, description),
}));
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({ getAwsRoleVerification: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/ops', () => ({
  getCollaborationChannel: vi.fn(async () => null),
  getTargetJiraTicket: vi.fn(async () => null),
  updateTargetSourceDoesSupportRaw: vi.fn(async () => undefined),
  // 이 파일의 픽스처에는 §10 응답이 없다 — 뷰의 .catch 가 받아 헬스만 '확인 실패'로 선다.
  getDagStatus: vi.fn(() => Promise.reject(new Error('no dag-status fixture'))),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => null),
  getTestConnectionResults: vi.fn(async () => []),
}));

const detail = (over: Record<string, unknown> = {}) => ({
  target_source_id: 1018,
  service_name: 'AWS',
  service_code: 'aws',
  cloud_provider: 'AWS',
  metadata: { is_sdu_type: false },
  ...over,
});

/** 접힘을 연다 — 설명은 열기 전에는 DOM 에 없다. */
const openFold = async (): Promise<void> => {
  fireEvent.click(await screen.findByRole('button', { name: '상세 정보' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1018');
});

describe('OpsTargetView — 「상세 정보」 설명', () => {
  it('접힘을 열기 전에는 설명이 화면에 없다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ description: '접힌 설명' }));
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    // 큐가 떴다는 것은 마스트헤드가 도착했다는 뜻이다 — "아직 로딩" 이 아니다.
    await screen.findByRole('button', { name: '상세 정보' });
    expect(screen.queryByText('접힌 설명')).toBeNull();
  });

  it('열면 전문이 그대로 — 100자에서 접지 않는다', async () => {
    // 레일이 236px 였을 때의 규칙이 여기 남아 있으면 140자가 100자+…로 잘린다.
    const long = 'a'.repeat(140);
    getRawTargetSourceDetail.mockResolvedValue(detail({ description: long }));
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    await openFold();
    expect((await screen.findByText(long)).textContent).toBe(long);
  });

  it('설명이 없으면 없음 + 등록하기', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    await openFold();
    // '등록하기'는 역할 셀에도 있다 — 설명은 title 로 잡는다. 그리고 '없음'은 같은
    // 그룹의 「최초 연동」에도 있으므로 셀까지 좁혀야 이 단언이 죽지 않는다.
    const register = await screen.findByTitle('설명 등록');
    expect(register.textContent).toBe('등록하기');
    const cell = register.closest('div');
    expect(cell?.textContent).toContain('없음');
    expect(cell?.textContent).not.toContain('최초 연동');
  });

  it('수정 → 저장이 API 를 부르고 접힘의 문단을 그 값으로 갱신한다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ description: '이전 설명' }));
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    await openFold();
    fireEvent.click(await screen.findByTitle('설명 수정'));
    const textarea = await screen.findByLabelText('설명');
    fireEvent.change(textarea, { target: { value: '새 설명' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(updateTargetSourceDescription).toHaveBeenCalledWith(1018, '새 설명'));
    expect(await screen.findByText('새 설명')).toBeTruthy();
  });
});
