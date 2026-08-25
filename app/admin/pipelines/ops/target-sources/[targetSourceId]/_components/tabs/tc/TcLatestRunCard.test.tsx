// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { computeTcBuckets, foldAgentStatuses } from '@/lib/test-connection-summary';
import { TcLatestRunCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcLatestRunCard';

/**
 * 밴드가 **말하지 않던 것**을 말하는지 — 순수 함수 테스트가 못 보는 자리들이다.
 * 문장·버킷·경과는 `lib/test-connection-summary` 가 이미 자기 테스트를 갖고 있고,
 * 여기서 잡는 것은 그 값들이 화면에 붙는 배선과 승인 요청 줄의 세 갈래다.
 */

const version = (
  agents: readonly (readonly [string, string])[],
  over: Partial<TestConnectionVersionResult> = {},
): TestConnectionVersionResult => ({
  target_source_id: 1,
  test_connection_version: 4,
  connection_status: 'SUCCESS',
  requested_at: '2026-08-25T02:00:00Z',
  completed_at: '2026-08-25T02:00:42Z',
  test_connection_agent_results: agents.map(([resource_id, connection_status]) => ({
    agent_id: `agent-${resource_id}`,
    resource_id,
    connection_status,
  })),
  ...over,
});

const bucketsOf = (
  unitIds: readonly string[],
  latest: TestConnectionVersionResult | null,
): ReturnType<typeof computeTcBuckets> =>
  computeTcBuckets(
    unitIds,
    foldAgentStatuses(latest?.test_connection_agent_results ?? [], new Set(unitIds)),
  );

const ack = (over: Partial<TestConnectionStatusRow> = {}): TestConnectionStatusRow => ({
  targetSourceId: 1,
  status: 'TEST_CONNECTION_COMPLETED',
  serviceName: null,
  serviceCode: null,
  cloudProvider: null,
  rejectReason: null,
  rejectedAt: null,
  completedAt: '2026-08-25T02:05:00Z',
  ...over,
});

const renderCard = (over: Partial<Parameters<typeof TcLatestRunCard>[0]> = {}) => {
  const latest = over.latest === undefined ? version([['r-1', 'SUCCESS']]) : over.latest;
  const props = {
    latest,
    status: null,
    buckets: bucketsOf(['r-1'], latest),
    credentialMissing: 0,
    credFilterOn: false,
    onToggleCredFilter: vi.fn(),
    loading: false,
    failed: false,
    statusFailed: false,
    statusLoaded: true,
    running: false,
    triggering: false,
    triggerFailed: false,
    onRunTest: vi.fn(),
    onReloadStatus: vi.fn(),
    onOpenRunHistory: vi.fn(),
    onOpenDecisionHistory: vi.fn(),
    ...over,
  };
  return { ...render(<TcLatestRunCard {...props} />), props };
};

describe('TcLatestRunCard — 승인 요청 줄', () => {
  it('아직 누르지 않았어도 줄이 선다 — 침묵은 "안 눌렀다"라는 사실이 아니다', () => {
    renderCard({ status: null });
    expect(screen.getByText('승인 요청')).toBeTruthy();
    expect(screen.getByText('아직 요청 안 함')).toBeTruthy();
  });

  it('조회 실패는 미요청과 다른 픽셀이고, 그 줄에 출구가 있다', () => {
    const { props } = renderCard({ status: null, statusFailed: true });
    expect(screen.queryByText('아직 요청 안 함')).toBeNull();
    expect(screen.getByText('조회 실패')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(props.onReloadStatus).toHaveBeenCalled();
  });

  it('눌렀으면 서비스 쪽 버튼 이름 그대로 "요청됨"이다', () => {
    renderCard({ status: ack() });
    expect(screen.getByText('요청됨')).toBeTruthy();
  });

  it('직전 회차의 도장을 이번 실행의 것처럼 그리지 않는다', () => {
    renderCard({
      status: ack({ completedAt: '2026-08-20T05:00:00Z' }),
      latest: version([['r-1', 'SUCCESS']], { requested_at: '2026-08-25T02:00:00Z' }),
    });
    expect(screen.getByText(/이전 실행 기준/)).toBeTruthy();
  });

  it('이번 실행 뒤에 찍힌 도장에는 그 꼬리표가 없다', () => {
    renderCard({ status: ack({ completedAt: '2026-08-25T02:05:00Z' }) });
    expect(screen.queryByText(/이전 실행 기준/)).toBeNull();
  });
});

describe('TcLatestRunCard — Credential 미설정 곁줄', () => {
  it('0 건이면 줄 자체가 없다 — 할 일이 없다는 말이 자리를 차지하지 않는다', () => {
    renderCard({ credentialMissing: 0 });
    expect(screen.queryByText(/Credential 미설정/)).toBeNull();
  });

  it('건수를 말하고, 그 줄의 링크가 곧 표의 필터다', () => {
    const { props } = renderCard({ credentialMissing: 3 });
    expect(screen.getByText(/Credential 미설정/)).toBeTruthy();
    const toggle = screen.getByRole('button', { name: '미설정만 보기' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(props.onToggleCredFilter).toHaveBeenCalled();
  });

  it('걸려 있으면 되돌릴 말을 건다', () => {
    renderCard({ credentialMissing: 3, credFilterOn: true });
    expect(screen.getByRole('button', { name: '전체 보기' })).toBeTruthy();
  });

  it('실행을 잠그지는 않는다 — 관리자 화면은 서비스가 막혔을 때의 우회로다', () => {
    renderCard({ credentialMissing: 3, latest: null });
    expect(screen.getByRole('button', { name: '연결 테스트 실행' }).hasAttribute('disabled')).toBe(
      false,
    );
  });
});

describe('TcLatestRunCard — 국면이 CTA 를 고른다', () => {
  it('미실행은 실행, 실패는 다시 실행, 진행 중은 잠긴 채로 국면을 말한다', () => {
    const { unmount } = renderCard({ latest: null });
    expect(screen.getByRole('button', { name: '연결 테스트 실행' })).toBeTruthy();
    unmount();

    const failed = renderCard({ latest: version([['r-1', 'FAIL']], { connection_status: 'FAIL' }) });
    expect(screen.getByRole('button', { name: '다시 실행' })).toBeTruthy();
    failed.unmount();

    renderCard({
      latest: version([], { connection_status: 'RUNNING', completed_at: null }),
      running: true,
    });
    const slot = screen.getByRole('button', { name: '진행 중…' });
    expect(slot.hasAttribute('disabled')).toBe(true);
  });

  it('조회에 실패하면 국면을 아는 척하지 않는다 — idle 은 "실행한 적 없다"는 판정이다', () => {
    renderCard({ latest: null, failed: true });
    expect(screen.getByText('실행 정보를 불러오지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('아직 실행한 연결 테스트가 없습니다')).toBeNull();
    // 셀 대상조차 확인하지 못했으므로 수를 말하지 않는다.
    expect(screen.queryByText('대상 리소스')).toBeNull();
  });

  it('실행이 없으면 빈 모달로 가는 입구도 없다', () => {
    renderCard({ latest: null });
    expect(screen.queryByRole('button', { name: '실행 기록' })).toBeNull();
  });
});
