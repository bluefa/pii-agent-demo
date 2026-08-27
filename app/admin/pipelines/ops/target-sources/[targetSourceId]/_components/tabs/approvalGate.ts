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

/** dag-status fetch lifecycle — 'loading' doubles as "not fetched yet". The page
 *  owns it and only asks when a reader exists (승인 조건 ③ · Airflow 확인 탭). */
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
  /** 연동 완료 CTA 의 잠금을 푼다 — true on exactly one state: 세 조건이 모두 충족.
   *  (버튼 자체는 늘 마운트된다 — 오너 2026-08-26.) */
  canApprove: boolean;
  /**
   * 조건이 실제로 미충족인가 — 경고 아이콘이 이 값을 보고 선다.
   *
   * `!canApprove` 와 다르다: 조회 중이거나 판정하지 못한 상태는 "충족되지 않았다"가
   * 아니라 "아직 모른다"이고, 관리자가 할 일도 다르다(기다린다 vs 조건을 푼다).
   */
  unmet: boolean;
}

/**
 * 미충족 머리 문장 — 하나뿐이다 (오너 2026-08-26).
 *
 * 예전에는 막힌 이유마다 다른 문장이 섰다("모니터링이 UNHEALTHY 상태예요 — 설치 완료를
 * 처리할 수 없어요"). 그 줄은 두 가지를 잘못했다: 계약의 enum 을 그대로 읽어 관리자에게
 * 필드 이름을 먼저 배우게 했고(wire 어휘는 UI 문장이 아니다), 카드 셋이 이미 조건별로
 * 말하는 이유를 머리에서 한 번 더 말해 같은 사실이 두 벌이 됐다. 머리는 결정만 진다 —
 * 무엇이 왜 막혔는지는 그 조건의 카드가 안다.
 */
const UNMET = '승인 조건이 충족되지 않았습니다.';

export function foldApprovalHead(
  tcStatus: string | null | undefined,
  /** status 조회가 404 아닌 이유로 거절됐는가 — 조회 실패를 '미요청'으로 읽지 않기 위해. */
  statusFailed: boolean,
  run: TcRunGate,
  dag: DagFetch,
): ApprovalHead {
  // 'loading' 은 최신 실행만 모르는 상태가 아니다 — TC 세 응답이 한 번에 오므로
  // tcStatus 도 아직 모른다. tcStatus 를 읽는 분기보다 먼저 답해야 "완료 승인 대기"
  // 같은 사실을 도착 전에 단정하지 않는다.
  if (run === 'loading') {
    return {
      pill: { tone: 'off', label: '결과 확인 중' },
      desc: '연결 테스트 결과를 확인하고 있어요.',
      canApprove: false,
      unmet: false,
    };
  }
  if (statusFailed) {
    return {
      pill: { tone: 'err', label: '확인 실패' },
      desc: '완료 승인 상태를 확인하지 못했어요.',
      canApprove: false,
      unmet: false,
    };
  }
  if (tcStatus === TC_REJECTED) {
    return {
      pill: { tone: 'warn', label: '재실행 요청됨' },
      desc: UNMET,
      canApprove: false,
      unmet: true,
    };
  }
  if (tcStatus !== TC_COMPLETED) {
    // 버튼 이름 안내(5단계 · 승인 요청)는 조건 ① 카드의 C-1 캡션으로 옮겨졌다 — 머리는
    // 결정만 지고 여기 desc 는 UNMET 하나라 어느 이름도 부르지 않는다. 그 캡션이 서는
    // 조건은 `showsHandoffCaption` 이 진다.
    return {
      pill: { tone: 'off', label: '완료 승인 대기' },
      desc: UNMET,
      canApprove: false,
      unmet: true,
    };
  }
  // 조건 ② — 최신 실행이 성공이라고 말할 때만 다음 조건으로 넘어간다.
  switch (run) {
    case 'success':
      break;
    case 'failed':
      return {
        pill: { tone: 'err', label: '승인 불가' },
        desc: UNMET,
        canApprove: false,
        unmet: true,
      };
    case 'open':
      return {
        pill: { tone: 'off', label: '테스트 진행 중' },
        desc: UNMET,
        canApprove: false,
        unmet: true,
      };
    case 'none':
      return {
        pill: { tone: 'off', label: '결과 없음' },
        desc: UNMET,
        canApprove: false,
        unmet: true,
      };
    case 'error':
      return {
        pill: { tone: 'err', label: '확인 실패' },
        desc: '연결 테스트 결과를 확인하지 못했어요.',
        canApprove: false,
        unmet: false,
      };
    case 'unknown':
      return {
        pill: { tone: 'off', label: '미확인' },
        desc: '연결 테스트 결과를 판정할 수 없어요.',
        canApprove: false,
        unmet: false,
      };
  }
  switch (dag.phase) {
    case 'loading':
      return {
        pill: { tone: 'off', label: '헬스 확인 중' },
        desc: '모니터링 상태를 확인하고 있어요.',
        canApprove: false,
        unmet: false,
      };
    case 'failed':
      return {
        pill: { tone: 'err', label: '확인 실패' },
        desc: '모니터링 상태를 확인하지 못했어요.',
        canApprove: false,
        unmet: false,
      };
    case 'loaded': {
      const verdict = healthVerdict(dag.data.healthStatus);
      switch (verdict.kind) {
        case 'healthy':
          return {
            pill: { tone: 'ok', label: '처리 대기' },
            desc: '세 조건이 모두 충족됐어요 — 설치를 완료 처리할 수 있어요.',
            canApprove: true,
            unmet: false,
          };
        case 'unhealthy':
          return {
            pill: { tone: 'err', label: '승인 불가' },
            desc: UNMET,
            canApprove: false,
            unmet: true,
          };
        case 'unknown':
          // Wire vocabulary (enum raw, field name) never rides in sentence-tier
          // copy — the raw value lives in the checklist row's tooltip channel.
          return {
            pill: { tone: 'off', label: '미확인' },
            desc: '모니터링 상태를 판정할 수 없어요.',
            canApprove: false,
            unmet: false,
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

/**
 * 세는 값 한 조각 — "총 14개", "14개 성공", "0개 확인 필요".
 *
 * 수와 낱말을 나눠 두는 이유는 렌더 때문이다: 수는 한 단 크고 굵게, 낱말은 한 단 작게
 * 선다 (오너 2026-08-26: "숫자는 14픽셀로 올리고"). 문자열 한 벌로 내려보내면 호출부가
 * 정규식으로 숫자를 도로 찾아내야 한다.
 */
export interface CountSegment {
  /** 수 앞에 붙는 낱말 — '총'. */
  prefix?: string;
  count: number;
  /** 수 뒤에 붙는 낱말 — '개', '개 성공', '개 확인 필요'. */
  suffix: string;
}

/** 근거 한 줄의 라벨–값 — 승인 카드가 조건 ② 와 같은 문법으로 그린다. */
export interface MonitoringEvidenceFact {
  label: string;
  segments: readonly CountSegment[];
}

export interface MonitoringEvidenceHead {
  pill: EvidencePill;
  /** 산문 한 줄 — 셀 수 있는 사실이 아직 없을 때(조회 중·조회 실패·미지 값). */
  subtitle: string | null;
  /**
   * 라벨–값 행 (오너 2026-08-26: "Dag 상황도 test connection 처럼 정리해줘").
   *
   * ` · ` 로 이어 붙인 한 문장이던 것을 사실마다 한 행으로 나눈다. 낱말은 그대로다 —
   * 값의 이름(논리 DB·에이전트)만 왼쪽 라벨 열로 나가고, 문장의 종결어미가 값에 어울리는
   * 명사형으로 바뀐다. 이 문장은 Airflow 확인 탭이 쓰지 않으므로(그 탭은 알약만 공유한다)
   * 두 화면이 갈라질 일은 없다.
   */
  facts: readonly MonitoringEvidenceFact[];
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
  // 리소스(에이전트) 도 논리 DB 와 같은 셈으로 말한다 (오너 2026-08-26) — 연결된 것이
  // 성공, 나머지가 확인 필요. 라벨이 '리소스' 인 것은 이 줄이 세는 것이 EC2·RDS 같은
  // 등록 리소스이기 때문이다.
  const resources = (): readonly MonitoringEvidenceFact[] =>
    agg
      ? [
          {
            label: '리소스',
            segments: [
              { prefix: '총', count: agg.agentTotal, suffix: '개' },
              { count: agg.agentConnected, suffix: '개 성공' },
              { count: agg.agentTotal - agg.agentConnected, suffix: '개 확인 필요' },
            ],
          },
        ]
      : [];
  switch (dag.phase) {
    case 'loading':
      return {
        pill: { tone: 'off', label: '확인 중' },
        subtitle: '모니터링 상태를 확인하고 있어요',
        facts: [],
      };
    case 'failed':
      return {
        pill: { tone: 'err', label: '확인 실패' },
        subtitle: '모니터링 상태를 확인하지 못했어요',
        facts: [],
      };
    case 'loaded': {
      const verdict = healthVerdict(dag.data.healthStatus);
      if (verdict.kind === 'unknown') {
        return {
          pill: { tone: 'off', label: '미확인' },
          subtitle: '판정할 수 없는 값',
          facts: [],
          titleHint: `healthStatus: ${verdict.raw}`,
        };
      }
      return {
        pill:
          verdict.kind === 'healthy'
            ? { tone: 'ok', label: 'HEALTHY' }
            : { tone: 'err', label: 'UNHEALTHY' },
        subtitle: null,
        // 논리 DB 는 세어서 말한다 (오너 2026-08-26). "전부 최근 7일 성공" 같은 문장은
        // 판정문이 이미 진 스코프를 한 번 더 반복하면서 정작 몇 개가 어땠는지는 안 셌다.
        //
        // 두 판정이 같은 행을 쓴다 — 정상인지 아닌지는 알약이 말하고 이 행은 세기만 한다.
        // 확인 필요는 성공의 여집합이다: 요약 카운트 줄(`attentionCount` 의 네 버킷 합)이
        // 세는 집합과 같은 수라, 조건 카드와 Airflow 확인 탭이 다른 수를 말하지 않는다.
        facts: agg
          ? [
              {
                label: '논리 DB',
                segments: [
                  { prefix: '총', count: agg.dbTotal, suffix: '개' },
                  { count: agg.succeeded, suffix: '개 성공' },
                  { count: agg.dbTotal - agg.succeeded, suffix: '개 확인 필요' },
                ],
              },
              ...resources(),
            ]
          : [],
      };
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
