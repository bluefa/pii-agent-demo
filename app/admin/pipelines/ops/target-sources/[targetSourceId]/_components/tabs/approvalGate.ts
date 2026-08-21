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
import type { TcExecutionStatus } from '@/app/lib/api/task-queue-tc';
import type { TcTone } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type { TcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

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
      desc: '재실행을 요청했습니다. 서비스가 다시 완료 승인을 요청하면 처리할 수 있습니다.',
      canApprove: false,
      canRerun: false,
    };
  }
  if (tcStatus !== TC_COMPLETED) {
    // 서비스 쪽 실제 버튼 이름(완료 승인 요청, Step 5 카드)으로 말한다 — 화면에 없는
    // 이름을 안내하면 관리자가 서비스에 전달할 때 서로 다른 버튼을 찾게 된다.
    return {
      pill: { tone: 'off', label: '완료 승인 대기' },
      desc: '서비스가 5단계에서 완료 승인을 요청하면 처리할 수 있습니다.',
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

/**
 * C-1 조건부 캡션 — 혼동은 "테스트 성공 + 완료 승인 미요청" 한 상태에서만 생기므로,
 * 그 상태에서만 게이트 ① 이 인수인계(5단계 완료 승인 요청)를 설명한다. 재실행을
 * 요청한 뒤에는 왜 멈췄는지 관리자 자신이 알고 있어 설명이 소음이 된다.
 */
export const showsHandoffCaption = (
  tcStatus: string | null | undefined,
  run: TcExecutionStatus,
): boolean => tcStatus !== TC_COMPLETED && tcStatus !== TC_REJECTED && run === 'SUCCESS';

/**
 * 근거 행의 알약 — 사실만 나른다. 판정 아이콘(✓·✗·○)은 승인 조건 행의 것이다:
 * 근거의 실패는 승인을 잠그지 않으므로(게이트는 ① 완료 승인 ② 헬스뿐), 근거 행에
 * ✗ 를 세우면 "승인 불가"라는 거짓말이 된다.
 */
export interface EvidencePill {
  tone: TcTone;
  label: string;
}

export function tcEvidencePill(stats: TcResultStats, run: TcExecutionStatus): EvidencePill {
  if (run === 'PENDING' || run === 'RUNNING') return { tone: 'warn', label: '진행 중' };
  if (stats.failedCount > 0)
    return { tone: 'err', label: `실패 ${stats.failedCount.toLocaleString('ko-KR')}` };
  if (stats.successCount > 0) {
    const s = stats.successCount.toLocaleString('ko-KR');
    const r = stats.resourceCount.toLocaleString('ko-KR');
    return { tone: 'ok', label: `성공 ${s}/${r}` };
  }
  return { tone: 'off', label: '결과 없음' };
}

export interface MonitoringEvidenceHead {
  pill: EvidencePill;
  subtitle: string | null;
  /** Wire vocabulary (raw enum) — tooltip channel only. */
  titleHint?: string;
}

/**
 * 모니터링 근거 행의 접힌 줄 — 알약은 헬스 판정, 보조 줄은 그 근거(관측 스코프).
 * HEALTHY/UNHEALTHY 는 요약 밴드가 이미 화면 어휘로 굳힌 표기라 그대로 쓴다;
 * 그 밖의 미지 값만 '미확인'으로 접고 raw 는 툴팁에 남는다.
 */
export function monitoringEvidenceHead(
  dag: DagFetch,
  agg: DagAggregates | null,
): MonitoringEvidenceHead {
  const n = (value: number): string => value.toLocaleString('ko-KR');
  switch (dag.phase) {
    case 'loading':
      return { pill: { tone: 'off', label: '확인 중' }, subtitle: '모니터링 상태를 확인하고 있어요' };
    case 'failed':
      return {
        pill: { tone: 'err', label: '확인 실패' },
        subtitle: '모니터링 상태를 확인하지 못했어요',
      };
    case 'loaded': {
      const verdict = healthVerdict(dag.data.healthStatus);
      const agents = agg ? ` · 에이전트 ${n(agg.agentConnected)}/${n(agg.agentTotal)} 연결` : '';
      switch (verdict.kind) {
        case 'healthy':
          return {
            pill: { tone: 'ok', label: 'HEALTHY' },
            subtitle: agg
              ? agg.dbTotal === 0
                ? `DAG 관측 논리 DB 없음${agents}`
                : agg.succeeded === agg.dbTotal
                  ? `DAG 관측 논리 DB ${n(agg.dbTotal)}개 전부 최근 7일 성공${agents}`
                  : `DAG 관측 논리 DB ${n(agg.dbTotal)}개 중 ${n(agg.succeeded)}개 최근 7일 성공${agents}`
              : null,
          };
        case 'unhealthy':
          // UNHEALTHY 문장이 세는 것은 succeededThisWeek=false 뿐 — 밴드와 같은 규칙.
          return {
            pill: { tone: 'err', label: 'UNHEALTHY' },
            subtitle: agg
              ? `논리 DB ${n(agg.noSuccess)}개가 최근 7일 성공 기록이 없어요${agents}`
              : null,
          };
        case 'unknown':
          return {
            pill: { tone: 'off', label: '미확인' },
            subtitle: '판정할 수 없는 값',
            titleHint: `healthStatus: ${verdict.raw}`,
          };
      }
    }
  }
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
