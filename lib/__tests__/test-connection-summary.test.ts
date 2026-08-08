import { describe, expect, it } from 'vitest';
import {
  computeTcBuckets,
  foldAgentStatuses,
  tcElapsedLabel,
  tcSummarySentence,
} from '@/lib/test-connection-summary';

const agent = (id: string, status: string) => ({ resource_id: id, connection_status: status } as never);

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

  it('reports progress as reported/total while running', () => {
    expect(tcSummarySentence('running', settled)).toBe('연결 테스트 진행 중 — 3/3 대상 보고됨');
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
