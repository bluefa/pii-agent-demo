import { describe, it, expect } from 'vitest';
import {
  aggregateDagStatus,
  classifyDb,
  foldApprovalHead,
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
// per row. The approve CTA mounts on exactly one of the seven.
describe('foldApprovalHead', () => {
  it('row 1 — TC 미완료: both CTAs unmounted, current copy preserved', () => {
    const head = foldApprovalHead(null, { phase: 'loading' });
    expect(head).toMatchObject({ canApprove: false, canRerun: false });
    expect(head.pill).toEqual({ tone: 'off', label: '대기 중' });
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
