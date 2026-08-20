// @vitest-environment jsdom
/**
 * 레일의 설명 그룹 (오너 08-20 여섯째 조정) — 표시는 100자에서 접고, 쓰기는
 * DescriptionEditModal(assumed §8)을 재사용한다. 접기 상수와 저장-후-갱신은
 * 이 파일에만 살아 있다: 접기를 지워도, 저장이 로컬 detail 을 안 덮어도 다른
 * 테스트는 전부 초록이다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const getRawTargetSourceDetail = vi.fn();
const updateTargetSourceDescription = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: vi.fn(async () => ({ content: [], totalPages: 1 })),
  startScan: vi.fn(async () => null),
}));
vi.mock('@/app/lib/api', () => ({
  getProcessStatus: vi.fn(async () => null),
  updateTargetSourceDescription: (...args: unknown[]) => updateTargetSourceDescription(...args),
}));
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
  target_source_id: 1018,
  service_name: 'AWS',
  service_code: 'aws',
  cloud_provider: 'AWS',
  metadata: { is_sdu_type: false },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1018');
});

describe('OpsTargetView — 레일 설명 그룹', () => {
  it('100자 넘는 설명은 100자에서 접고 전문은 title 로 남긴다', async () => {
    const long = 'a'.repeat(140);
    getRawTargetSourceDetail.mockResolvedValue(detail({ description: long }));
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    const prose = await screen.findByTitle(long);
    expect(prose.textContent).toBe(`${'a'.repeat(100)}…`);
  });

  it('100자 이하는 그대로 — 접힌 척(…)하지 않는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ description: '짧은 설명' }));
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    expect((await screen.findByText('짧은 설명')).textContent).toBe('짧은 설명');
  });

  it('설명이 없으면 없음 + 등록하기', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    // '없음'은 Jira 행에도, '등록하기'는 역할 행에도 있다 — 설명 그룹은 title 로 잡는다.
    const register = await screen.findByTitle('설명 수정');
    expect(register.textContent).toBe('등록하기');
    expect(register.closest('section')?.textContent).toContain('없음');
  });

  it('수정 → 저장이 API 를 부르고 레일 문단을 그 값으로 갱신한다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ description: '이전 설명' }));
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    fireEvent.click(await screen.findByTitle('설명 수정'));
    const textarea = await screen.findByLabelText('설명');
    fireEvent.change(textarea, { target: { value: '새 설명' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(updateTargetSourceDescription).toHaveBeenCalledWith(1018, '새 설명'));
    expect(await screen.findByText('새 설명')).toBeTruthy();
  });
});
