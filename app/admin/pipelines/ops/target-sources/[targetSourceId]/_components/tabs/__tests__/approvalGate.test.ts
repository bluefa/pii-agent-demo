import { describe, it, expect } from 'vitest';
import {
  aggregateDagStatus,
  classifyDb,
  foldApprovalHead,
  monitoringEvidenceHead,
  showsHandoffCaption,
  tcRunGate,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import type { DagDatabaseStatus, DagStatusResponse } from '@/lib/types/dag-status';

const day = (status: string, successTime: string | null = null) => ({
  day: '2026-08-19',
  status,
  successTime,
});

const db = (over: Partial<DagDatabaseStatus>): DagDatabaseStatus => ({
  databaseUri: 'mysql://10.0.0.1:3306/db',
  databaseName: 'db',
  schemaName: 'db',
  dagName: 'pii_scan_db',
  namespace: 'composer-prod',
  succeededThisWeek: false,
  lastSuccessAt: null,
  days: [],
  ...over,
});

const response = (healthStatus: string, dbs: DagDatabaseStatus[] = []): DagStatusResponse => ({
  targetSourceId: 1,
  connectionStatus: 'SUCCESS',
  healthStatus,
  timezone: 'KST',
  agents: [
    {
      agentId: 'agent-1',
      resourceId: 'r-1',
      gcpRegion: null,
      connectionStatus: 'SUCCESS',
      databaseStatuses: dbs,
    },
  ],
});

const loaded = (healthStatus: string): DagFetch => ({
  phase: 'loaded',
  data: response(healthStatus),
  fetchedAt: '2026-08-19T09:12:04Z',
});

// The 승인 가능 truth table (docs/api/ops-assumed-contracts.md §10) — one case
// per row. The approve CTA mounts on exactly one of them: ① 완료 승인 ∧ ② 최신 실행
// 성공 ∧ ③ HEALTHY.
describe('foldApprovalHead', () => {
  it('row 1 — TC 미완료: both CTAs unmounted, 서비스 쪽 버튼 이름(완료 승인)으로 말한다', () => {
    const head = foldApprovalHead(null, false, 'success', { phase: 'loading' });
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'off', label: '완료 승인 대기' });
    // Step 5 CTA 의 실제 라벨은 "승인 요청" — 화면에 없는 이름을 안내하지 않는다.
    expect(head.desc).toContain('완료 승인');
    expect(head.desc).toContain('5단계');
  });

  it('row 2 — REJECTED: both CTAs unmounted regardless of dag state', () => {
    const head = foldApprovalHead('TEST_CONNECTION_REJECTED', false, 'success', loaded('HEALTHY'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'warn', label: '재실행 요청됨' });
  });

  it('row 3 — COMPLETED + loading: approve locked', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', { phase: 'loading' });
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'off', label: '헬스 확인 중' });
  });

  it('row 4 — COMPLETED + fetch failure: locked (failure is not an empty result)', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', { phase: 'failed' });
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'err', label: '확인 실패' });
  });

  it('row 5 — COMPLETED + HEALTHY: the one approvable state', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', loaded('HEALTHY'));
    expect(head.canApprove).toBe(true);
    expect(head.pill).toEqual({ tone: 'ok', label: '처리 대기' });
  });

  it('row 6 — COMPLETED + UNHEALTHY: approve locked', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', loaded('UNHEALTHY'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'err', label: '승인 불가' });
  });

  it('row 7 — COMPLETED + unknown enum: locked, raw value kept OUT of the copy', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', loaded('DEGRADED'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'off', label: '미확인' });
    // Wire vocabulary never rides in sentence-tier copy — tooltip channel only.
    expect(head.desc).not.toContain('DEGRADED');
    expect(head.desc).not.toContain('healthStatus');
  });

  // 조건 ② — HEALTHY 라도 최신 실행이 성공이라고 말하지 않으면 승인은 잠긴다.
  it('COMPLETED + 실행 실패: approve locked even when health is HEALTHY', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'failed', loaded('HEALTHY'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'err', label: '승인 불가' });
  });

  it('COMPLETED + 도착 전 / 진행 중 / 이력 없음 / 조회 실패 / 미지 enum: 전부 잠긴다', () => {
    for (const run of ['loading', 'open', 'none', 'error', 'unknown'] as const) {
      const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, run, loaded('HEALTHY'));
      expect(head.canApprove).toBe(false);
    }
  });

  it('도착 전·실행 실패·이력 없음·조회 실패는 서로 다른 문장이다 (실패 ≠ 빈 결과 ≠ 모름)', () => {
    const descs = (['loading', 'failed', 'none', 'error'] as const).map(
      (run) => foldApprovalHead('TEST_CONNECTION_COMPLETED', false, run, loaded('HEALTHY')).desc,
    );
    expect(new Set(descs).size).toBe(4);
  });

  it('status 조회 실패는 미요청과 다른 문장이다 — 404 가 아닌 거절은 모름이다', () => {
    const failed = foldApprovalHead(null, true, 'success', loaded('HEALTHY'));
    const pending = foldApprovalHead(null, false, 'success', loaded('HEALTHY'));
    expect(failed.canApprove).toBe(false);
    expect(failed.pill).toEqual({ tone: 'err', label: '확인 실패' });
    expect(failed.desc).not.toBe(pending.desc);
  });

  it('완료 승인된 대상이라도 status 조회 실패가 서 있으면 잠근다', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', true, 'success', loaded('HEALTHY'));
    expect(head.canApprove).toBe(false);
  });
});

// 조건 ② 의 판정 — 통과는 SUCCESS 하나뿐(ALLOWLIST)이고, 잠그는 이유는 갈라 둔다.
describe('tcRunGate', () => {
  it('SUCCESS 만 통과한다', () => {
    expect(tcRunGate('SUCCESS', true, false)).toBe('success');
    expect(tcRunGate('FAIL', true, false)).toBe('failed');
    expect(tcRunGate('RUNNING', true, false)).toBe('open');
    expect(tcRunGate('PENDING', true, false)).toBe('open');
    expect(tcRunGate('UNKNOWN', true, false)).toBe('unknown');
  });

  it('이력 없음과 조회 실패는 다른 사실이다', () => {
    expect(tcRunGate('UNKNOWN', false, false)).toBe('none');
    expect(tcRunGate('UNKNOWN', false, true)).toBe('error');
  });
});

// C-1 조건부 캡션 — 혼동은 "테스트 성공 + 완료 승인 미요청" 한 상태에서만 생긴다.
describe('showsHandoffCaption', () => {
  it('성공한 실행 + 미요청에서만 선다', () => {
    expect(showsHandoffCaption(null, 'SUCCESS')).toBe(true);
    expect(showsHandoffCaption('WAITING', 'SUCCESS')).toBe(true);
  });

  it('완료 승인 뒤·재실행 요청 뒤·실패한 실행에는 서지 않는다', () => {
    expect(showsHandoffCaption('TEST_CONNECTION_COMPLETED', 'SUCCESS')).toBe(false);
    expect(showsHandoffCaption('TEST_CONNECTION_REJECTED', 'SUCCESS')).toBe(false);
    expect(showsHandoffCaption(null, 'FAIL')).toBe(false);
    expect(showsHandoffCaption(null, 'RUNNING')).toBe(false);
  });
});

describe('monitoringEvidenceHead', () => {
  it('HEALTHY 전수 성공 — 논리 DB 는 세어서 말한다 (총계 중 성공, 나머지는 확인 필요)', () => {
    const data = response('HEALTHY', [
      db({ succeededThisWeek: true, days: [day('SUCCESS', '2026-08-18T07:00:00+09:00')] }),
    ]);
    const head = monitoringEvidenceHead(
      { phase: 'loaded', data, fetchedAt: '2026-08-19T09:12:04Z' },
      aggregateDagStatus(data),
    );
    expect(head.pill).toEqual({ tone: 'ok', label: 'HEALTHY' });
    // 사실마다 한 행 — 값의 이름은 라벨 열이 진다 (오너 2026-08-26).
    expect(head.subtitle).toBeNull();
    expect(head.facts).toEqual([
      { label: '논리 DB', value: '1개 중 1개 성공, 0개 확인 필요' },
      { label: '에이전트', value: '1/1 연결' },
    ]);
  });

  it('UNHEALTHY 는 succeededThisWeek=false 만 센다', () => {
    const data = response('UNHEALTHY', [db({}), db({ succeededThisWeek: true })]);
    const head = monitoringEvidenceHead(
      { phase: 'loaded', data, fetchedAt: '2026-08-19T09:12:04Z' },
      aggregateDagStatus(data),
    );
    expect(head.pill).toEqual({ tone: 'err', label: 'UNHEALTHY' });
    // 판정이 갈려도 행은 같다 — 정상 여부는 알약이 말하고 이 행은 센다.
    expect(head.facts[0]).toEqual({ label: '논리 DB', value: '2개 중 1개 성공, 1개 확인 필요' });
  });

  it('미지 enum — raw 는 툴팁 채널에만', () => {
    const head = monitoringEvidenceHead(loaded('DEGRADED'), aggregateDagStatus(response('DEGRADED')));
    expect(head.pill).toEqual({ tone: 'off', label: '미확인' });
    expect(head.subtitle).not.toContain('DEGRADED');
    expect(head.facts).toEqual([]);
    expect(head.titleHint).toBe('healthStatus: DEGRADED');
  });

  it('loading·failed 는 사실 그대로 — 실패는 빈 결과가 아니다', () => {
    expect(monitoringEvidenceHead({ phase: 'loading' }, null).pill.label).toBe('확인 중');
    expect(monitoringEvidenceHead({ phase: 'failed' }, null).pill).toEqual({
      tone: 'err',
      label: '확인 실패',
    });
  });
});

describe('classifyDb', () => {
  it('succeededThisWeek wins first — even with FAILED days present', () => {
    expect(
      classifyDb(db({ succeededThisWeek: true, days: [day('FAILED'), day('SUCCESS', '2026-08-18T07:00:00+09:00')] })),
    ).toBe('succeeded');
  });

  it('splits the no-success rest by day evidence', () => {
    expect(classifyDb(db({ days: [day('FAILED'), day('NOT_SCHEDULED')] }))).toBe('failed');
    expect(classifyDb(db({ days: [day('RUNNING'), day('NOT_SCHEDULED')] }))).toBe('running');
    expect(classifyDb(db({ days: [day('NOT_SCHEDULED'), day('NOT_SCHEDULED')] }))).toBe('unscheduled');
  });

  it('an unseen day status lands in other, not in 미스케줄', () => {
    expect(classifyDb(db({ days: [day('NOT_SCHEDULED'), day('QUEUED')] }))).toBe('other');
    expect(classifyDb(db({ days: [] }))).toBe('other');
  });
});

describe('aggregateDagStatus', () => {
  it('counts agents by SUCCESS allowlist and buckets every db exactly once', () => {
    const data = response('UNHEALTHY', [
      db({ succeededThisWeek: true, days: [day('SUCCESS', '2026-08-18T07:00:00+09:00')] }),
      db({ days: [day('FAILED')] }),
      db({ days: [day('NOT_SCHEDULED')] }),
    ]);
    data.agents.push({ ...data.agents[0], agentId: 'agent-2', connectionStatus: 'FAIL', databaseStatuses: [] });

    const agg = aggregateDagStatus(data);
    expect(agg).toMatchObject({
      agentTotal: 2,
      agentConnected: 1,
      dbTotal: 3,
      succeeded: 1,
      failed: 1,
      unscheduled: 1,
      running: 0,
      other: 0,
      noSuccess: 2,
    });
    expect(agg.succeeded + agg.failed + agg.running + agg.unscheduled + agg.other).toBe(agg.dbTotal);
  });
});
