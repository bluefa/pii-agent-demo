/**
 * 논리 DB 주간 보드 + 리소스별 DAG 표의 파생 로직 (assumed §10 dag-status).
 *
 * approvalGate.ts 가 게이트 판정(승인 가능/불가)을 접는 곳이라면, 여기는 관측층 —
 * 시안 C(에이전트 표)와 시안 D(DB 주간 보드)가 응답을 행으로 펼치고, 거르고,
 * 문제 우선으로 세우는 순수 함수들이다. 전부 allowlist: 계약 밖의 enum 값은
 * 'unknown'/'other' 로 떨어지지, 아는 상태로 위장하지 않는다.
 */
import { fmtDate, fmtDateTimeSec } from '@/lib/pipeline/format';
import type {
  DagDatabaseStatus,
  DagDayStatus,
  DagStatusResponse,
} from '@/lib/types/dag-status';
import type { TcTone } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  classifyDb,
  type DbBucket,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';

// ---------------------------------------------------------------------------
// 행 펼치기 — agents[].databaseStatuses[] 를 보드의 평평한 행으로
// ---------------------------------------------------------------------------

export interface DagDbRow {
  agentId: string;
  resourceId: string;
  db: DagDatabaseStatus;
  bucket: DbBucket;
}

export const flattenDagRows = (data: DagStatusResponse): DagDbRow[] =>
  data.agents.flatMap((a) =>
    a.databaseStatuses.map((db) => ({
      agentId: a.agentId,
      resourceId: a.resourceId,
      db,
      bucket: classifyDb(db),
    })),
  );

// ---------------------------------------------------------------------------
// 보드 필터 — 상태 칩(고정 슬롯) + 검색 + 에이전트 스코프
// ---------------------------------------------------------------------------

/**
 * 확인 필요 = **성공 아닌 전부** (오너 2026-08-26: "healthy/unhealthy 로 분기하고 싶어,
 * 그렇게 상세한 정보는 지금은 불필요").
 *
 * 08-25 에는 실패 + 스케줄 안 됨만 셌다. 그 경계가 흔들린 것은 `running` 때문이다 —
 * `classifyDb` 는 RUNNING 이 **오늘 칸인지 사흘 전 칸인지 보지 않아서**, 정상적으로 도는
 * 중인 DB 와 사흘째 멈춰 있는 DB 가 한 버킷에 앉는다. 후자는 명백히 확인 대상이므로
 * 그 버킷을 통째로 빼 두는 것은 틀린 쪽으로 기울어 있었다.
 *
 * 이제 규칙이 하나다: **최근 7일 성공 기록이 있으면 정상, 없으면 확인 필요.** 그리고 이
 * 집합은 `DagAggregates.noSuccess`(succeededThisWeek=false)와 정확히 같은 집합이라,
 * 카드 머리의 UNHEALTHY 문장("성공 기록이 없는 논리 DB가 있어요")이 세는 것과 그 아래
 * 수가 처음으로 같은 것을 가리킨다.
 *
 * 원인은 잃지 않는다 — 보드의 7일 스트립이 행마다 말한다(실패한 날은 빨간 칸, 안 걸린
 * 날은 빈 칸, 시작만 한 날은 주황). 합치는 것은 **수**고, 사실은 행에 그대로 남는다.
 * `DbBucket` 자체도 건드리지 않는다: 행 하나의 진짜 상태는 여전히 다섯 갈래다.
 */
export const ATTENTION_BUCKETS = ['failed', 'unscheduled', 'running', 'other'] as const;

type AttentionBucket = (typeof ATTENTION_BUCKETS)[number];

export const isAttentionBucket = (bucket: DbBucket): boolean =>
  ATTENTION_BUCKETS.some((attention) => attention === bucket);

/** 확인 필요 합계 — 요약 카운트 줄과 보드 칩이 같은 셈을 쓰게 하는 한 곳. */
export const attentionCount = (counts: Record<AttentionBucket, number>): number =>
  ATTENTION_BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0);

export type BoardFilter = DbBucket | 'attention' | 'ALL';

/** 필터 하나가 어떤 행을 받는지 — 'attention' 만 여러 버킷을 받는다. */
export const matchesBoardFilter = (bucket: DbBucket, filter: BoardFilter): boolean =>
  filter === 'ALL'
    ? true
    : filter === 'attention'
      ? isAttentionBucket(bucket)
      : bucket === filter;

export const BUCKET_LABEL: Record<DbBucket, string> = {
  failed: '실패',
  // 요약 카운트 줄과 같은 말 (오너 2026-08-25) — 한 화면에서 같은 버킷이 칩과 카운트에서
  // 다른 이름을 달면 다른 사실처럼 읽힌다. (날짜 칸의 '스케줄 없음'은 단위가 하루라 별개.)
  unscheduled: '스케줄 안 됨',
  // ⛔"진행 중"으로 되돌리지 말 것 — 이 값은 지난 날짜 칸에도 선다. 그날 실행이
  // 시작됐고 결과가 아직 없다는 사실까지가 응답이 아는 전부이고, "진행 중"은
  // 지금 돌고 있다는 말까지 해 버린다(연결 상태의 RUNNING 은 진짜 그 뜻이라 그쪽은 유지).
  running: '실행 시작',
  succeeded: '성공',
  // 계약 밖 day status 가 섞인 행 — 미스케줄로 위장시키지 않는 자리.
  other: '그 외',
};

/** 항상 자리를 지키는 칩 순서 (문제 먼저 — TcAgentResultList FIXED_FILTERS 문법).
 *  'other' 는 계약 밖의 값이 실제로 왔을 때만 생기므로 0건이면 감춘다. */
export const FIXED_BOARD_FILTERS: readonly Exclude<BoardFilter, 'ALL'>[] = [
  'attention',
  'succeeded',
];

/** 칩 이름 — 버킷 이름 + 합쳐진 슬롯 하나. 요약 카운트 줄이 쓰는 말과 같아야 한다. */
export const BOARD_FILTER_LABEL: Record<Exclude<BoardFilter, 'ALL'>, string> = {
  ...BUCKET_LABEL,
  attention: '확인 필요',
};

/** 에이전트 스코프 + 검색까지 좁힌 행 — 칩 카운트의 분모. 검색은 행에 보이는
 *  정체성 전부(이름·스키마·DAG)와 주소를 훑는다: 열로 세운 값은 찾을 수도 있어야
 *  한다. 대소문자는 무시. */
export const scopeBoardRows = (
  rows: readonly DagDbRow[],
  agentId: string | null,
  query: string,
): DagDbRow[] => {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (agentId && row.agentId !== agentId) return false;
    if (!q) return true;
    const { databaseUri, databaseName, schemaName, dagName } = row.db;
    return [databaseUri, databaseName, schemaName, dagName].some(
      (value) => value?.toLowerCase().includes(q) ?? false,
    );
  });
};

/**
 * DAG 이름 축약 — 이름은 300자까지 온다. 한 타깃의 DAG 들은 접두사를 공유하므로
 * 머리만 남기는 CSS ellipsis 로는 여러 행이 같은 문자열로 보인다: 꼬리가 정체성이라
 * 가운데를 접는다(논리 DB 모달 `abbrevMiddle` 과 같은 문법). 전체 이름은 셀 title.
 * 23자 예산은 DAG 열 176px(200 − 좌우 패딩 24) ÷ 12px mono 글자폭 기준.
 */
const DAG_HEAD = 12;
const DAG_TAIL = 10;

export const abbrevDagName = (name: string): string =>
  name.length > DAG_HEAD + DAG_TAIL + 1
    ? `${name.slice(0, DAG_HEAD)}…${name.slice(-DAG_TAIL)}`
    : name;

export const countBuckets = (rows: readonly DagDbRow[]): Record<DbBucket, number> => {
  const counts: Record<DbBucket, number> = {
    failed: 0,
    unscheduled: 0,
    running: 0,
    succeeded: 0,
    other: 0,
  };
  for (const row of rows) counts[row.bucket] += 1;
  return counts;
};

/** 문제 우선 — 실패가 맨 위, 성공이 맨 아래. wire 순서는 bucket 안에서만 산다
 *  (Task Card "집계=필터, 실패 우선" 결정과 같은 계보). */
const SEVERITY: Record<DbBucket, number> = {
  failed: 0,
  other: 1,
  unscheduled: 2,
  running: 3,
  succeeded: 4,
};

export const sortBoardRows = (rows: readonly DagDbRow[]): DagDbRow[] =>
  [...rows].sort((a, b) => SEVERITY[a.bucket] - SEVERITY[b.bucket]);

// ---------------------------------------------------------------------------
// 에이전트 요약 — 시안 C 표의 행
// ---------------------------------------------------------------------------

export interface DagAgentSummary {
  agentId: string;
  resourceId: string;
  gcpRegion: string | null;
  connectionStatus: string;
  dbTotal: number;
  succeeded: number;
  failed: number;
  running: number;
  unscheduled: number;
  /** 계약 밖의 상태값이 섞인 DB — 나쁜 값이 아니라 읽지 못한 값이다. */
  other: number;
}

/** 문제 우선 정렬: 연결이 SUCCESS 가 아닌 에이전트 먼저, 그 다음 실패 DB 많은 순.
 *  같은 등급 안에서는 wire 순서를 지킨다. */
export const summarizeAgents = (data: DagStatusResponse): DagAgentSummary[] =>
  data.agents
    .map((a) => {
      const counts = countBuckets(
        a.databaseStatuses.map((db) => ({
          agentId: a.agentId,
          resourceId: a.resourceId,
          db,
          bucket: classifyDb(db),
        })),
      );
      return {
        agentId: a.agentId,
        resourceId: a.resourceId,
        gcpRegion: a.gcpRegion,
        connectionStatus: a.connectionStatus,
        dbTotal: a.databaseStatuses.length,
        succeeded: counts.succeeded,
        failed: counts.failed,
        running: counts.running,
        unscheduled: counts.unscheduled,
        other: counts.other,
      };
    })
    .sort((a, b) => {
      const aConn = a.connectionStatus === 'SUCCESS' ? 1 : 0;
      const bConn = b.connectionStatus === 'SUCCESS' ? 1 : 0;
      if (aConn !== bConn) return aConn - bConn;
      return attentionCount(b) - attentionCount(a);
    });

/**
 * 모니터링 연결 상태 pill — allowlist fold. 계약 밖의 값은 '미확인'으로 접고
 * raw 는 label 에 싣지 않는다(wire 어휘는 문장·라벨 금지 — 툴팁 채널은 호출부 몫).
 */
/**
 * 행의 종합 상태 — **두 갈래뿐이다**: 정상 / 확인 필요 (오너 2026-08-26).
 *
 * 08-21 에는 연결 실패 · DAG 없음 · 실행 시작 · 그 외가 각자 알약을 가졌다. 그것들은
 * 전부 "왜"인데, 이 표가 답하는 질문은 "무엇을 봐야 하나" 하나뿐이라 판정 어휘가 다섯
 * 갈래일 이유가 없었다. 왜는 툴팁(hint)이 나르고, 더 깊은 왜는 보드의 7일 스트립이
 * 행마다 그린다.
 *
 * 규칙: 관측을 믿을 수 있고(연결 SUCCESS), 관측한 논리 DB 가 있고, 그 전부가 최근 7일
 * 성공 기록을 가지면 정상. 나머지는 전부 확인 필요다.
 *
 * - 연결이 SUCCESS 가 아니면 이 행의 수는 아무것도 뜻하지 않는다 — 관측 자체를 못 믿는
 *   행이라 그 사실이 곧 확인 대상이다.
 * - 관측 논리 DB 0개는 성공률 100% 가 아니라 **아무것도 안 보고 있다**는 뜻이다.
 *   부재에서 건강을 읽으면 안 된다. 셀 수가 없으므로 수는 붙지 않는다.
 * - 그 밖에는 성공하지 못한 논리 DB 가 하나라도 있으면 확인 필요다
 *   (`attentionCount` — 요약 카운트 줄이 쓰는 그 셈).
 *
 * 수는 내지 않는다 (오너 2026-08-26). 한 행에 수가 둘이면(규모·확인 필요) 판정 칸이
 * 다시 두 가지 일을 하고, 시안 A 가 분수를 걷은 이유로 되돌아간다. 몇 개인지는 툴팁이
 * 말하고, 세는 것은 규모 열과 요약 줄의 일이다.
 *
 * ⛔ 판정을 다시 갈래 내지 말 것. 한 화면에서 같은 낱말이 자리마다 다른 집합을 부르면
 * 그 낱말은 아무것도 뜻하지 않는다 — 한때 이 함수가 `dbTotal − succeeded` 로 판정하고
 * 요약 줄은 실패+미스케줄만 세서, 행에 '확인 필요' + 빨간 레일이 선 리소스를 눌러 열면
 * 0건이었다. 지금은 둘 다 `attentionCount` 하나를 지난다.
 *
 * raw enum 은 hint(툴팁 채널)로만 나른다 — wire 어휘는 라벨에 싣지 않는다.
 */
export const agentVerdict = (
  agent: DagAgentSummary,
): { tone: TcTone; label: string; hint?: string } => {
  const attention = { tone: 'err' as const, label: '확인 필요' };
  if (agent.connectionStatus !== 'SUCCESS') {
    const conn = connPill(agent.connectionStatus);
    return { ...attention, hint: `모니터링 연결 ${conn.label} — connectionStatus: ${conn.raw ?? agent.connectionStatus}` };
  }
  if (agent.dbTotal === 0) {
    return { ...attention, hint: '이 리소스에서 관측 중인 논리 DB 가 없어요' };
  }
  const count = attentionCount(agent);
  if (count === 0) {
    return { tone: 'ok', label: '정상', hint: '관측 논리 DB 전부 최근 7일 성공' };
  }
  return { ...attention, hint: `논리 DB ${count}개가 최근 7일 성공 기록이 없어요` };
};

export const connPill = (
  connectionStatus: string,
): { tone: TcTone; label: string; raw?: string } => {
  switch (connectionStatus) {
    case 'SUCCESS':
      return { tone: 'ok', label: '성공' };
    case 'FAIL':
      return { tone: 'err', label: '실패' };
    case 'RUNNING':
      return { tone: 'warn', label: '진행 중' };
    case 'PENDING':
      return { tone: 'off', label: '대기' };
    default:
      return { tone: 'off', label: '미확인', raw: connectionStatus };
  }
};

/**
 * 리소스 표시명 — 경로형 id(GCP·Azure)는 마지막 '/' 조각, ARN 같은 콜론형 id 는
 * 마지막 ':' 조각. 한 대상의 행들은 앞부분이 글자 단위로 같아서 실제로 줄을
 * 가르는 것은 이 조각뿐이다(resourceIdTail 과 같은 이유, ARN 까지 확장).
 * 전체 값은 항상 옆의 mono id 셀 툴팁에 있다.
 */
export const agentDisplayName = (resourceId: string): string => {
  const bySlash = resourceId.split('/').filter(Boolean);
  if (bySlash.length > 1) return bySlash[bySlash.length - 1];
  const byColon = resourceId.split(':').filter(Boolean);
  return byColon.length > 1 ? byColon[byColon.length - 1] : resourceId;
};

// ---------------------------------------------------------------------------
// 7일 스트립 셀 — 상태 allowlist + 툴팁 문장 (시안 E)
// ---------------------------------------------------------------------------

export type DayCellKind = 'ok' | 'fail' | 'run' | 'none' | 'unknown';

export const dayCellKind = (status: string): DayCellKind => {
  switch (status) {
    case 'SUCCESS':
      return 'ok';
    case 'FAILED':
      return 'fail';
    case 'RUNNING':
      return 'run';
    case 'NOT_SCHEDULED':
      return 'none';
    default:
      // 계약 밖의 값 — 부재(none)로 위장시키지 않는다.
      return 'unknown';
  }
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'YYYY-MM-DD' → '8월 15일 (토)'. 달력 날짜의 요일은 타임존과 무관하다. */
export const dayLabel = (day: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const [, y, mo, d] = m;
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return `${Number(mo)}월 ${Number(d)}일 (${weekday})`;
};

/**
 * 오늘 칸 — 배열의 마지막이 아니라 날짜로 정한다. 계약은 "7칸, KST 버킷"까지만
 * 약속하고 순서도, 창이 오늘로 끝난다는 것도 말하지 않는다. 창이 어제 닫힌 응답에서
 * 마지막 칸에 링을 씌우면 어제를 오늘이라고 부르게 된다 — 그럴 땐 링이 서지 않는 게
 * 사실이다. 버킷이 KST 이므로 비교도 KST 달력 날짜로 한다.
 */
export const isTodayKst = (day: string, now: Date = new Date()): boolean =>
  day === fmtDate(now.toISOString());

/** successTime → KST 'HH:mm:ss'. 실패·미스케줄엔 시각이 없다(계약). */
const timeOf = (iso: string | null): string | null => {
  if (!iso) return null;
  const formatted = fmtDateTimeSec(iso);
  return formatted.includes(' ') ? formatted.split(' ')[1] : null;
};

/** 셀 툴팁 한 문장 — raw enum 은 미지의 값일 때만, 툴팁 채널이므로 실을 수 있다. */
export const dayCellTip = (day: DagDayStatus): string => {
  const date = dayLabel(day.day);
  switch (dayCellKind(day.status)) {
    case 'ok': {
      const time = timeOf(day.successTime);
      return time ? `${date} · 성공 · ${time}` : `${date} · 성공`;
    }
    case 'fail':
      return `${date} · 실패`;
    case 'run':
      return `${date} · 실행 시작`;
    case 'none':
      return `${date} · 스케줄 없음`;
    case 'unknown':
      return `${date} · 판정할 수 없는 값 (status: ${day.status})`;
  }
};
