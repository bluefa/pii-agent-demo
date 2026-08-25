/**
 * 관리자 승인 gate — the single fold point for the tab's head state.
 *
 * Three conditions gate the approve CTA (docs/api/ops-assumed-contracts.md §10):
 *   ① the service acknowledged Test Connection (status = TEST_CONNECTION_COMPLETED)
 *   ② the latest Test Connection run SUCCEEDED — by ALLOWLIST (`=== 'SUCCESS'`)
 *   ③ monitoring health is HEALTHY — by ALLOWLIST (`=== 'HEALTHY'`), so loading,
 *     fetch failure, and enum values we have not seen all LOCK instead of passing.
 *
 * 잠긴 조건을 푸는 동작은 이 탭에 없다 — 연결 테스트의 재실행도, 헬스의 복구도 각자의
 * 탭이 가진다. 여기서 나오는 것은 판정과 그 판정을 만든 근거로 가는 길뿐이다.
 */
import type { DagDatabaseStatus, DagStatusResponse } from '@/lib/types/dag-status';
import type { TcExecutionStatus } from '@/app/lib/api/task-queue-tc';
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

/**
 * 최신 연결 테스트 실행의 게이트 판정 — 승인 조건 ②.
 *
 * 통과는 실행 단위 `connection_status === 'SUCCESS'` 하나뿐(ALLOWLIST)이다. 나머지는
 * 전부 잠근다. 잠그는 이유는 갈라 둔다 — 이력이 없는 것과 조회에 실패한 것은 다른
 * 사실이고, 승인 조건 행이 그 둘을 같은 문장으로 말하면 안 된다.
 */
export type TcRunGate =
  | 'success'
  | 'failed'
  /** 아직 답이 안 왔다 — '이력 없음'이라고 말해 버리기 전의 자리. */
  | 'loading'
  /** PENDING · RUNNING — 아직 끝나지 않은 실행. */
  | 'open'
  /** 실행 이력 없음 (404). */
  | 'none'
  /** 최신 실행 조회 실패 — 빈 결과가 아니다. */
  | 'error'
  /** 선언된 enum 밖의 값. */
  | 'unknown';

export function tcRunGate(run: TcExecutionStatus, hasLatest: boolean, latestFailed: boolean): TcRunGate {
  if (!hasLatest) return latestFailed ? 'error' : 'none';
  switch (run) {
    case 'SUCCESS':
      return 'success';
    case 'FAIL':
      return 'failed';
    case 'PENDING':
    case 'RUNNING':
      return 'open';
    default:
      return 'unknown';
  }
}

export interface ApprovalHead {
  pill: { tone: TcTone; label: string };
  desc: string;
  /** Mounts PII Agent 설치 완료 — true on exactly one state: 세 조건이 모두 충족. */
  canApprove: boolean;
}

export function foldApprovalHead(
  tcStatus: string | null | undefined,
  run: TcRunGate,
  dag: DagFetch,
): ApprovalHead {
  if (tcStatus === TC_REJECTED) {
    return {
      pill: { tone: 'warn', label: '재실행 요청됨' },
      desc: '재실행을 요청했습니다. 서비스가 다시 완료 승인을 요청하면 처리할 수 있습니다.',
      canApprove: false,
    };
  }
  if (tcStatus !== TC_COMPLETED) {
    // 서비스 쪽 실제 버튼 이름(승인 요청, Step 5 카드)으로 말한다 — 화면에 없는
    // 이름을 안내하면 관리자가 서비스에 전달할 때 서로 다른 버튼을 찾게 된다.
    return {
      pill: { tone: 'off', label: '완료 승인 대기' },
      desc: '서비스가 5단계에서 완료 승인을 요청하면 처리할 수 있습니다.',
      canApprove: false,
    };
  }
  // 조건 ② — 최신 실행이 성공이라고 말할 때만 다음 조건으로 넘어간다.
  switch (run) {
    case 'success':
      break;
    case 'failed':
      return {
        pill: { tone: 'err', label: '승인 불가' },
        desc: '최신 연결 테스트가 실패했어요 — 설치 완료를 처리할 수 없어요.',
        canApprove: false,
      };
    case 'open':
      return {
        pill: { tone: 'off', label: '테스트 진행 중' },
        desc: '연결 테스트가 아직 끝나지 않았어요.',
        canApprove: false,
      };
    case 'loading':
      return {
        pill: { tone: 'off', label: '결과 확인 중' },
        desc: '연결 테스트 결과를 확인하고 있어요.',
        canApprove: false,
      };
    case 'none':
      return {
        pill: { tone: 'off', label: '결과 없음' },
        desc: '연결 테스트 실행 기록이 없어 설치 완료를 처리할 수 없어요.',
        canApprove: false,
      };
    case 'error':
      return {
        pill: { tone: 'err', label: '확인 실패' },
        desc: '연결 테스트 결과를 확인하지 못했어요.',
        canApprove: false,
      };
    case 'unknown':
      return {
        pill: { tone: 'off', label: '미확인' },
        desc: '연결 테스트 결과를 판정할 수 없어 설치 완료를 처리할 수 없어요.',
        canApprove: false,
      };
  }
  switch (dag.phase) {
    case 'loading':
      return {
        pill: { tone: 'off', label: '헬스 확인 중' },
        desc: '모니터링 상태를 확인하고 있어요.',
        canApprove: false,
      };
    case 'failed':
      return {
        pill: { tone: 'err', label: '확인 실패' },
        desc: '모니터링 상태를 확인하지 못했어요.',
        canApprove: false,
      };
    case 'loaded': {
      const verdict = healthVerdict(dag.data.healthStatus);
      switch (verdict.kind) {
        case 'healthy':
          return {
            pill: { tone: 'ok', label: '처리 대기' },
            desc: '세 조건이 모두 충족됐어요 — 설치를 완료 처리할 수 있어요.',
            canApprove: true,
          };
        case 'unhealthy':
          return {
            pill: { tone: 'err', label: '승인 불가' },
            desc: '모니터링이 UNHEALTHY 상태예요 — 설치 완료를 처리할 수 없어요.',
            canApprove: false,
          };
        case 'unknown':
          // Wire vocabulary (enum raw, field name) never rides in sentence-tier
          // copy — the raw value lives in the checklist row's tooltip channel.
          return {
            pill: { tone: 'off', label: '미확인' },
            desc: '모니터링 상태를 판정할 수 없어 설치 완료를 처리할 수 없어요.',
            canApprove: false,
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

/** 모니터링 근거 줄의 알약 — 헬스 판정을 화면 어휘로 나른다. */
export interface EvidencePill {
  tone: TcTone;
  label: string;
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
