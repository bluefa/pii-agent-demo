// @vitest-environment jsdom
/**
 * 셸 스켈레톤의 **본문 슬롯** — 상세가 오기 전에 그리는 프레임이 도착 후의 모양과
 * 같은가.
 *
 * 이 화면은 들어올 때마다 이 프레임을 한 번 그린다. 한 칸짜리 320px 블록이던 시절에는
 * 상세가 도착하는 순간 한 칸이 두 칸으로 갈리면서 본문이 320 → 432.39px 로 뛰었다
 * (브라우저 실측). `currentTab` 은 조기 반환 **위에서** 이미 정해지므로, 어느 탭이
 * 정착할지는 상세 없이도 알 수 있다 — 그래서 프레임은 그 탭의 모양을 진다.
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

// 상세를 **끝나지 않게** 둔다 — 로딩 프레임이 이 테스트가 보려는 화면 전부다.
const getRawTargetSourceDetail = vi.fn(() => new Promise(() => {}));

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: () => getRawTargetSourceDetail(),
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

/** 정착본의 본문 슬롯(`opsStyles.pagedCardBody`)이 지고 있는 그 높이. */
const BODY_SLOT = '.min-h-\\[266px\\]';
/** 한 칸짜리 블록 — 딥링크로 연 탭의 모양이고, 진행 상태의 모양은 아니다. */
const ONE_BLOCK = '.h-\\[320px\\]';

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1642');
});

describe('OpsTargetView — 로딩 중 본문 프레임', () => {
  it('진행 상태로 들어오면 두 칸 카드 행을 그린다 — 한 칸 블록이 아니다', () => {
    const { container } = render(
      <OpsTargetView targetSourceId={1642} initialTab="진행 상태" statusSlot={<div />} />,
    );

    const row = container.querySelector('.grid.grid-cols-2');
    expect(row).not.toBeNull();
    // 두 칸이다. 한 칸으로 돌아가면 도착하는 순간 칸이 갈리며 본문이 100px 넘게 뛴다.
    expect(row?.children.length).toBe(2);
    expect(container.querySelector(ONE_BLOCK)).toBeNull();
  });

  it('두 칸 각각이 정착 카드의 본문 슬롯을 그대로 쓴다 — 높이를 다시 세지 않는다', () => {
    const { container } = render(
      <OpsTargetView targetSourceId={1642} initialTab="진행 상태" statusSlot={<div />} />,
    );

    // min-h-[266px] 는 `opsStyles.pagedCardBody` 의 것이다. 이 셀렉터가 비면 누군가
    // 그 높이를 여기에 손으로 옮겨 적었다는 뜻이고, 그때부터 둘은 따로 움직인다.
    expect(container.querySelectorAll(BODY_SLOT).length).toBe(2);
  });

  it('딥링크로 연 탭은 한 칸이다 — 두 칸 행을 그리지 않는다', () => {
    const { container } = render(
      <OpsTargetView targetSourceId={1642} initialTab="인프라 작업" statusSlot={<div />} />,
    );

    expect(container.querySelector('.grid.grid-cols-2')).toBeNull();
    expect(container.querySelector(ONE_BLOCK)).not.toBeNull();
  });
});
