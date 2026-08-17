import { describe, expect, it } from 'vitest';
import {
  computeTcBuckets,
  foldAgentStatuses,
  foldTcCardState,
  tcElapsedLabel,
  tcSummarySentence,
} from '@/lib/test-connection-summary';

// foldAgentStatuses 의 실제 파라미터 타입(Pick)으로 그대로 만든다 — wire 타입이 바뀌면
// 이 픽스처가 같이 깨져야 한다 (`as never` 캐스트는 그 신호를 삼켰다).
const agent = (
  id: string,
  status: string,
): { resource_id: string; connection_status: string } => ({
  resource_id: id,
  connection_status: status,
});

describe('foldAgentStatuses', () => {
  it('folds FAIL-first: a later SUCCESS cannot overwrite a FAIL', () => {
    const map = foldAgentStatuses([agent('r1', 'FAIL'), agent('r1', 'SUCCESS')], new Set(['r1']));
    expect(map.get('r1')).toBe('FAIL');
  });

  it('a unit is SUCCESS only when every report is SUCCESS', () => {
    const map = foldAgentStatuses([agent('r1', 'SUCCESS'), agent('r1', 'RUNNING')], new Set(['r1']));
    expect(map.get('r1')).toBe('RUNNING');
  });

  it('out-of-contract values fold to UNKNOWN, never a claimed success', () => {
    const map = foldAgentStatuses([agent('r1', 'WEIRD'), agent('r1', 'SUCCESS')], new Set(['r1']));
    expect(map.get('r1')).toBe('UNKNOWN');
  });

  it('ignores ids outside unitIds when a set is given, keeps all without one', () => {
    const agents = [agent('r1', 'SUCCESS'), agent('ghost', 'FAIL')];
    expect(foldAgentStatuses(agents, new Set(['r1'])).has('ghost')).toBe(false);
    expect(foldAgentStatuses(agents).get('ghost')).toBe('FAIL');
  });
});

describe('computeTcBuckets', () => {
  it('counts 미보고 separately from PENDING and caps % at reported/total', () => {
    const statuses = foldAgentStatuses(
      [agent('a', 'SUCCESS'), agent('b', 'FAIL'), agent('c', 'PENDING')],
      new Set(['a', 'b', 'c', 'd']),
    );
    const buckets = computeTcBuckets(['a', 'b', 'c', 'd'], statuses);
    expect(buckets).toMatchObject({ ok: 1, fail: 1, waiting: 1, unreported: 1, reported: 2, total: 4 });
    // 2/4 answered — the old total-based math would have said 50% even with 0 reports pending.
    expect(buckets.pct).toBe(50);
  });

  it('an unfinished run can no longer read 100%', () => {
    const statuses = foldAgentStatuses([agent('a', 'SUCCESS')], new Set(['a', 'b']));
    expect(computeTcBuckets(['a', 'b'], statuses).pct).toBe(50);
  });
});

describe('tcSummarySentence', () => {
  const settled = computeTcBuckets(
    ['a', 'b', 'c'],
    foldAgentStatuses([agent('a', 'SUCCESS'), agent('b', 'SUCCESS'), agent('c', 'FAIL')], new Set(['a', 'b', 'c'])),
  );

  it('states the fail count on a failed run', () => {
    expect(tcSummarySentence('fail', settled)).toBe('리소스 3개 중 2개 연결 성공 — 실패 1건을 점검해 주세요');
  });

  it('a SUCCESS run never claims 모두 when the counts disagree (unit missing from results)', () => {
    const diverged = computeTcBuckets(
      ['a', 'b', 'c'],
      foldAgentStatuses([agent('a', 'SUCCESS'), agent('b', 'SUCCESS')], new Set(['a', 'b', 'c'])),
    );
    expect(tcSummarySentence('success', diverged)).toBe(
      '리소스 3개 중 2개 연결 성공 — 나머지 1건은 결과가 확인되지 않았어요',
    );
    const clean = computeTcBuckets(
      ['a', 'b'],
      foldAgentStatuses([agent('a', 'SUCCESS'), agent('b', 'SUCCESS')], new Set(['a', 'b'])),
    );
    expect(tcSummarySentence('success', clean)).toBe('리소스 2개 모두 연결에 성공했어요');
  });

  it('reports progress as reported/total while running', () => {
    expect(tcSummarySentence('running', settled)).toBe('연결 테스트 진행 중 — 3/3 대상 보고됨');
  });

  it('queued says 시작 대기, never 진행 중 — top-level PENDING 은 아무것도 돌지 않는다', () => {
    const empty = computeTcBuckets(['a', 'b'], foldAgentStatuses([], new Set(['a', 'b'])));
    expect(tcSummarySentence('queued', empty)).toBe('연결 테스트 요청됨 — 시작을 기다리고 있어요');
  });

  it('a FAIL with zero reports folds into the generic fail sentence — no special state', () => {
    // 오너 결정: "결과가 보고되기 전에 실패" 같은 무보고 서사는 실패와 구분되지 않는다.
    const unreported = computeTcBuckets(['a', 'b'], foldAgentStatuses([], new Set(['a', 'b'])));
    expect(tcSummarySentence('fail', unreported)).toBe(
      '연결 테스트가 실패했어요 — 다시 수행해 주세요',
    );
  });

  it('idle states the absence of a run, not a zero-count verdict', () => {
    expect(tcSummarySentence('idle', computeTcBuckets([], foldAgentStatuses([])))).toBe(
      '아직 실행한 연결 테스트가 없습니다',
    );
  });

  it('the verdict states carry their own sentences', () => {
    expect(tcSummarySentence('policy-changed', settled)).toBe(
      '논리 DB 정책이 마지막 실행 이후 변경됐어요',
    );
    expect(tcSummarySentence('confirmed', settled)).toBe('연결 테스트 완료 확인됨');
  });
});

describe('foldTcCardState', () => {
  it('refines a settled SUCCESS by the completion verdict', () => {
    expect(foldTcCardState('success', 'CONFIRMED')).toBe('confirmed');
    expect(foldTcCardState('success', 'LOGICAL_DATABASE_RECENTLY_UPDATED')).toBe('policy-changed');
    expect(foldTcCardState('success', 'LATEST_TEST_CONNECTION_SUCCESS')).toBe('success');
    // 판정을 아직 못 읽은 한 왕복 동안은 success 로 남는다 — 승인 게이트가 따로 닫는다.
    expect(foldTcCardState('success', null)).toBe('success');
  });

  it('ignores the verdict outside a settled SUCCESS (조회 보류 규칙)', () => {
    expect(foldTcCardState('running', 'CONFIRMED')).toBe('running');
    expect(foldTcCardState('queued', 'CONFIRMED')).toBe('queued');
    expect(foldTcCardState('fail', 'LOGICAL_DATABASE_RECENTLY_UPDATED')).toBe('fail');
    expect(foldTcCardState('idle', 'LATEST_TEST_CONNECTION_SUCCESS')).toBe('idle');
  });
});

describe('tcElapsedLabel', () => {
  it('renders 초/분 short forms and rejects inverted ranges', () => {
    expect(tcElapsedLabel('2026-08-06T05:02:11Z', '2026-08-06T05:03:09Z')).toBe('58초');
    expect(tcElapsedLabel('2026-08-06T05:02:00Z', '2026-08-06T05:04:12Z')).toBe('2분 12초');
    expect(tcElapsedLabel('2026-08-06T05:04:00Z', '2026-08-06T05:02:00Z')).toBeNull();
    expect(tcElapsedLabel(null, '2026-08-06T05:02:00Z')).toBeNull();
  });
});
