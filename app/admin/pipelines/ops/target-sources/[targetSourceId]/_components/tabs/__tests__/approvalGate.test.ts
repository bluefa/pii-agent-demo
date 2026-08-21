import { describe, it, expect } from 'vitest';
import {
  aggregateDagStatus,
  classifyDb,
  foldApprovalHead,
  monitoringEvidenceHead,
  showsHandoffCaption,
  tcEvidencePill,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import type { TcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
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
// per row. The approve CTA mounts on exactly one of the seven.
describe('foldApprovalHead', () => {
  it('row 1 — TC 미완료: both CTAs unmounted, 서비스 쪽 버튼 이름(완료 승인)으로 말한다', () => {
    const head = foldApprovalHead(null, { phase: 'loading' });
    expect(head).toMatchObject({ canApprove: false, canRerun: false });
    expect(head.pill).toEqual({ tone: 'off', label: '완료 승인 대기' });
    // Step 5 CTA 의 실제 라벨은 "완료 승인 요청" — 화면에 없는 이름을 안내하지 않는다.
    expect(head.desc).toContain('완료 승인');
    expect(head.desc).toContain('5단계');
  });

  it('row 2 — REJECTED: both CTAs unmounted regardless of dag state', () => {
    const head = foldApprovalHead('TEST_CONNECTION_REJECTED', loaded('HEALTHY'));
    expect(head).toMatchObject({ canApprove: false, canRerun: false });
    expect(head.pill).toEqual({ tone: 'warn', label: '재실행 요청됨' });
  });

  it('row 3 — COMPLETED + loading: approve locked, rerun stays open', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', { phase: 'loading' });
    expect(head).toMatchObject({ canApprove: false, canRerun: true });
    expect(head.pill).toEqual({ tone: 'off', label: '헬스 확인 중' });
  });

  it('row 4 — COMPLETED + fetch failure: locked (failure is not an empty result)', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', { phase: 'failed' });
    expect(head).toMatchObject({ canApprove: false, canRerun: true });
    expect(head.pill).toEqual({ tone: 'err', label: '확인 실패' });
  });

  it('row 5 — COMPLETED + HEALTHY: the one approvable state', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', loaded('HEALTHY'));
    expect(head).toMatchObject({ canApprove: true, canRerun: true });
    expect(head.pill).toEqual({ tone: 'ok', label: '처리 대기' });
  });

  it('row 6 — COMPLETED + UNHEALTHY: approve locked, rerun is the exit', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', loaded('UNHEALTHY'));
    expect(head).toMatchObject({ canApprove: false, canRerun: true });
    expect(head.pill).toEqual({ tone: 'err', label: '승인 불가' });
  });

  it('row 7 — COMPLETED + unknown enum: locked, raw value kept OUT of the copy', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', loaded('DEGRADED'));
    expect(head).toMatchObject({ canApprove: false, canRerun: true });
    expect(head.pill).toEqual({ tone: 'off', label: '미확인' });
    // Wire vocabulary never rides in sentence-tier copy — tooltip channel only.
    expect(head.desc).not.toContain('DEGRADED');
    expect(head.desc).not.toContain('healthStatus');
  });
});

const stats = (over: Partial<TcResultStats>): TcResultStats => ({
  resourceCount: 5,
  includedTotal: 52,
  excludedTotal: 2,
  successCount: 5,
  failedCount: 0,
  runningCount: 0,
  unknownCount: 0,
  ...over,
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

// 근거 행의 알약은 사실만 나른다 — 판정 아이콘(✓·✗·○)은 승인 조건 행의 것.
describe('tcEvidencePill', () => {
  it('전부 성공 → 성공 s/r', () => {
    expect(tcEvidencePill(stats({}), 'SUCCESS')).toEqual({ tone: 'ok', label: '성공 5/5' });
  });

  it('실패가 있으면 err 로 사실만 — "승인 불가"라는 어휘는 쓰지 않는다', () => {
    const pill = tcEvidencePill(stats({ successCount: 3, failedCount: 2 }), 'SUCCESS');
    expect(pill).toEqual({ tone: 'err', label: '실패 2' });
  });

  it('실행이 아직 열려 있으면 진행 중 — 부분 결과를 성패로 올리지 않는다', () => {
    expect(tcEvidencePill(stats({}), 'RUNNING')).toEqual({ tone: 'warn', label: '진행 중' });
    expect(tcEvidencePill(stats({}), 'PENDING')).toEqual({ tone: 'warn', label: '진행 중' });
  });

  it('판정할 결과가 없으면 결과 없음', () => {
    expect(
      tcEvidencePill(stats({ resourceCount: 0, successCount: 0 }), 'UNKNOWN'),
    ).toEqual({ tone: 'off', label: '결과 없음' });
  });
});

describe('monitoringEvidenceHead', () => {
  it('HEALTHY 전수 성공 — 관측 스코프(DAG 관측)가 라벨에 선다 (P5 라벨 분리)', () => {
    const data = response('HEALTHY', [
      db({ succeededThisWeek: true, days: [day('SUCCESS', '2026-08-18T07:00:00+09:00')] }),
    ]);
    const head = monitoringEvidenceHead(
      { phase: 'loaded', data, fetchedAt: '2026-08-19T09:12:04Z' },
      aggregateDagStatus(data),
    );
    expect(head.pill).toEqual({ tone: 'ok', label: 'HEALTHY' });
    expect(head.subtitle).toBe('DAG 관측 논리 DB 1개 전부 최근 7일 성공 · 에이전트 1/1 연결');
  });

  it('UNHEALTHY 는 succeededThisWeek=false 만 센다', () => {
    const data = response('UNHEALTHY', [db({}), db({ succeededThisWeek: true })]);
    const head = monitoringEvidenceHead(
      { phase: 'loaded', data, fetchedAt: '2026-08-19T09:12:04Z' },
      aggregateDagStatus(data),
    );
    expect(head.pill).toEqual({ tone: 'err', label: 'UNHEALTHY' });
    expect(head.subtitle).toContain('논리 DB 1개가 최근 7일 성공 기록이 없어요');
  });

  it('미지 enum — raw 는 툴팁 채널에만', () => {
    const head = monitoringEvidenceHead(loaded('DEGRADED'), aggregateDagStatus(response('DEGRADED')));
    expect(head.pill).toEqual({ tone: 'off', label: '미확인' });
    expect(head.subtitle).not.toContain('DEGRADED');
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
