// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
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


const renderCard = (over: Partial<Parameters<typeof TcLatestRunCard>[0]> = {}) => {
  const latest = over.latest === undefined ? version([['r-1', 'SUCCESS']]) : over.latest;
  const props = {
    latest,
    buckets: bucketsOf(['r-1'], latest),
    credentialMissing: 0,
    credFilterOn: false,
    onToggleCredFilter: vi.fn(),
    loading: false,
    failed: false,
    running: false,
    triggering: false,
    triggerFailed: false,
    onRunTest: vi.fn(),
    onOpenRunHistory: vi.fn(),
    onOpenDecisionHistory: vi.fn(),
    onOpenCredentials: vi.fn(),
    children: null,
    ...over,
  };
  return { ...render(<TcLatestRunCard {...props} />), props };
};

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

  it('실행을 잠근다 — 결과가 SECRET_NOT_FOUND 로 정해진 실행은 시작시키지 않는다', () => {
    renderCard({ credentialMissing: 3, latest: null });
    const run = screen.getByRole('button', { name: '연결 테스트 실행' });
    expect(run.hasAttribute('disabled')).toBe(true);
    // ⛔ 이유 없이 잠긴 버튼은 만들지 않는다 — 사유는 카드 첫 줄과 버튼 자신이 함께 진다.
    expect(run.getAttribute('title')).toContain('Credential 미설정 3건');
    expect(screen.getByText(/지정해야 연결 테스트를 실행할 수 있어요/)).toBeTruthy();
  });

  it('배정이 다 끝나면 잠금도 사유도 없다', () => {
    renderCard({ credentialMissing: 0, latest: null });
    const run = screen.getByRole('button', { name: '연결 테스트 실행' });
    expect(run.hasAttribute('disabled')).toBe(false);
    expect(run.getAttribute('title')).toBeNull();
  });
});

describe('TcLatestRunCard — 국면이 CTA 를 고른다', () => {
  it('미실행은 실행, 정착한 뒤에는 연결 테스트, 진행 중은 잠긴 채로 국면을 말한다', () => {
    const { unmount } = renderCard({ latest: null });
    expect(screen.getByRole('button', { name: '연결 테스트 실행' })).toBeTruthy();
    unmount();

    const failed = renderCard({ latest: version([['r-1', 'FAIL']], { connection_status: 'FAIL' }) });
    expect(screen.getByRole('button', { name: '연결 테스트' })).toBeTruthy();
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
