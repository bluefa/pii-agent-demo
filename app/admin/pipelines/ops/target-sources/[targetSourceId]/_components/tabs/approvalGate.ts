/**
 * 관리자 승인 gate — the single fold point for the tab's head state.
 *
 * Two conditions gate the approve CTA (docs/api/ops-assumed-contracts.md §10):
 *   ① the service acknowledged Test Connection (status = TEST_CONNECTION_COMPLETED)
 *   ② monitoring health is HEALTHY — by ALLOWLIST (`=== 'HEALTHY'`), so loading,
 *     fetch failure, and enum values we have not seen all LOCK instead of passing.
 *
 * 재실행 요청 stays mounted whenever ① holds: on UNHEALTHY it is the operator's
 * only exit, but nothing here claims a rerun fixes health — the contract does
 * not say that.
 */
import type { DagDatabaseStatus, DagStatusResponse } from '@/lib/types/dag-status';
import type { TcTone } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

export const TC_COMPLETED = 'TEST_CONNECTION_COMPLETED';
export const TC_REJECTED = 'TEST_CONNECTION_REJECTED';

/** dag-status fetch lifecycle — 'loading' doubles as "not fetched yet";
 *  consumers gate on TC completion before reading it. */
export type DagFetch =
  | { phase: 'loading' }
  | { phase: 'failed' }
  | { phase: 'loaded'; data: DagStatusResponse; fetchedAt: string };

export type HealthVerdict =
  | { kind: 'healthy' }
  | { kind: 'unhealthy' }
  | { kind: 'unknown'; raw: string };

export const healthVerdict = (healthStatus: string): HealthVerdict =>
  healthStatus === 'HEALTHY'
    ? { kind: 'healthy' }
    : healthStatus === 'UNHEALTHY'
      ? { kind: 'unhealthy' }
      : { kind: 'unknown', raw: healthStatus };

export interface ApprovalHead {
  pill: { tone: TcTone; label: string };
  desc: string;
  /** Mounts PII Agent 설치 완료 — true on exactly one state: TC 완료 ∧ HEALTHY. */
  canApprove: boolean;
  /** Mounts 재실행 요청 — true whenever TC 완료 (the escape stays open). */
  canRerun: boolean;
}

export function foldApprovalHead(tcStatus: string | null | undefined, dag: DagFetch): ApprovalHead {
  if (tcStatus === TC_REJECTED) {
    return {
      pill: { tone: 'warn', label: '재실행 요청됨' },
      desc: '재실행을 요청했습니다. 서비스가 다시 완료를 확인하면 처리할 수 있습니다.',
      canApprove: false,
      canRerun: false,
    };
  }
  if (tcStatus !== TC_COMPLETED) {
    return {
      pill: { tone: 'off', label: '대기 중' },
      desc: '서비스가 Test Connection 완료를 확인하면 처리할 수 있습니다.',
      canApprove: false,
      canRerun: false,
    };
  }
  switch (dag.phase) {
    case 'loading':
      return {
        pill: { tone: 'off', label: '헬스 확인 중' },
        desc: '모니터링 상태를 확인하고 있어요.',
        canApprove: false,
        canRerun: true,
      };
    case 'failed':
      return {
        pill: { tone: 'err', label: '확인 실패' },
        desc: '모니터링 상태를 확인하지 못했어요.',
        canApprove: false,
        canRerun: true,
      };
    case 'loaded': {
      const verdict = healthVerdict(dag.data.healthStatus);
      switch (verdict.kind) {
        case 'healthy':
          return {
            pill: { tone: 'ok', label: '처리 대기' },
            desc: 'Test Connection 결과를 확인한 뒤 재실행을 요청하거나 설치를 완료 처리하세요.',
            canApprove: true,
            canRerun: true,
          };
        case 'unhealthy':
          return {
            pill: { tone: 'err', label: '승인 불가' },
            desc: '모니터링이 UNHEALTHY 상태예요 — 설치 완료를 처리할 수 없어요.',
            canApprove: false,
            canRerun: true,
          };
        case 'unknown':
          // Wire vocabulary (enum raw, field name) never rides in sentence-tier
          // copy — the raw value lives in the checklist row's tooltip channel.
          return {
            pill: { tone: 'off', label: '미확인' },
            desc: '모니터링 상태를 판정할 수 없어 설치 완료를 처리할 수 없어요.',
            canApprove: false,
            canRerun: true,
          };
      }
    }
  }
}

/** 주간 판정 bucket per 논리 DB — succeededThisWeek is the contract's own verdict
 *  and wins first; the rest split by day evidence, allowlist per bucket so an
 *  unseen day status lands in 'other' instead of masquerading as 미스케줄. */
export type DbBucket = 'succeeded' | 'failed' | 'running' | 'unscheduled' | 'other';

export const classifyDb = (db: DagDatabaseStatus): DbBucket => {
  if (db.succeededThisWeek) return 'succeeded';
  if (db.days.some((d) => d.status === 'FAILED')) return 'failed';
  if (db.days.some((d) => d.status === 'RUNNING')) return 'running';
  if (db.days.length > 0 && db.days.every((d) => d.status === 'NOT_SCHEDULED')) return 'unscheduled';
  return 'other';
};

export interface DagAggregates {
  agentTotal: number;
  /** connectionStatus === 'SUCCESS' (allowlist). */
  agentConnected: number;
  dbTotal: number;
  succeeded: number;
  failed: number;
  running: number;
  unscheduled: number;
  other: number;
  /** succeededThisWeek=false count — what the UNHEALTHY sentence counts. */
  noSuccess: number;
}

export function aggregateDagStatus(data: DagStatusResponse): DagAggregates {
  const agg: DagAggregates = {
    agentTotal: data.agents.length,
    agentConnected: 0,
    dbTotal: 0,
    succeeded: 0,
    failed: 0,
    running: 0,
    unscheduled: 0,
    other: 0,
    noSuccess: 0,
  };
  for (const a of data.agents) {
    if (a.connectionStatus === 'SUCCESS') agg.agentConnected += 1;
    for (const db of a.databaseStatuses) {
      agg.dbTotal += 1;
      agg[classifyDb(db)] += 1;
      if (!db.succeededThisWeek) agg.noSuccess += 1;
    }
  }
  return agg;
}
