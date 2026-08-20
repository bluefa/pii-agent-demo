/**
 * 논리 DB 주간 보드 + 리소스별 DAG 표의 파생 로직 (assumed §10 dag-status).
 *
 * approvalGate.ts 가 게이트 판정(승인 가능/불가)을 접는 곳이라면, 여기는 관측층 —
 * 시안 C(에이전트 표)와 시안 D(DB 주간 보드)가 응답을 행으로 펼치고, 거르고,
 * 문제 우선으로 세우는 순수 함수들이다. 전부 allowlist: 계약 밖의 enum 값은
 * 'unknown'/'other' 로 떨어지지, 아는 상태로 위장하지 않는다.
 */
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type {
  DagDatabaseStatus,
  DagDayStatus,
  DagStatusResponse,
} from '@/lib/types/dag-status';
import type { TcTone } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  classifyDb,
  healthVerdict,
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

export type BoardFilter = DbBucket | 'ALL';

export const BUCKET_LABEL: Record<DbBucket, string> = {
  failed: '실패',
  unscheduled: '미스케줄',
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
export const FIXED_BOARD_FILTERS: readonly DbBucket[] = [
  'failed',
  'unscheduled',
  'running',
  'succeeded',
];

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

/**
 * 보드 진입 필터 — UNHEALTHY 로 들어왔고 실패 행이 실제로 있을 때만 실패를
 * 선적용한다(시안 D "UNHEALTHY 진입: 실패 필터 선적용"). 실패 0건인 UNHEALTHY
 * (전부 미스케줄 등)에서 실패 필터를 걸면 빈 보드가 첫 화면이 된다.
 */
export const initialBoardFilter = (
  healthStatus: string,
  counts: Record<DbBucket, number>,
): BoardFilter =>
  healthVerdict(healthStatus).kind === 'unhealthy' && counts.failed > 0 ? 'failed' : 'ALL';

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
  /** unscheduled + other — 분포 바의 점선(부재) 몫. */
  rest: number;
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
        rest: counts.unscheduled + counts.other,
      };
    })
    .sort((a, b) => {
      const aConn = a.connectionStatus === 'SUCCESS' ? 1 : 0;
      const bConn = b.connectionStatus === 'SUCCESS' ? 1 : 0;
      if (aConn !== bConn) return aConn - bConn;
      return b.failed - a.failed;
    });

/**
 * 모니터링 연결 상태 pill — allowlist fold. 계약 밖의 값은 '미확인'으로 접고
 * raw 는 label 에 싣지 않는다(wire 어휘는 문장·라벨 금지 — 툴팁 채널은 호출부 몫).
 */
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
