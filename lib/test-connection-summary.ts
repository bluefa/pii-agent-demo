import type { TestConnectionAgentResult } from '@/app/lib/api';

/**
 * Shared fold + bucket rules for the Step 5 connection-test summary.
 *
 * Domain: a test RUN is TargetSource-scoped — one run re-tests every unit, and a
 * unit's verdict only means anything inside that run. These helpers turn the run's
 * agent results into per-unit verdicts and honest phase-aware counts.
 */

/** Per-unit verdict inside one run. UNKNOWN = the wire sent an out-of-contract value. */
export type UnitTcStatus = 'SUCCESS' | 'FAIL' | 'RUNNING' | 'PENDING' | 'UNKNOWN';

const CONTRACT_STATUSES: readonly UnitTcStatus[] = ['SUCCESS', 'FAIL', 'RUNNING', 'PENDING'];

/**
 * Severity fold for several agents reporting on one unit — FAIL wins, and a unit
 * is SUCCESS only when every report is SUCCESS (admin logic.ts rule; the previous
 * last-write-wins map could overwrite a FAIL with a later SUCCESS).
 */
const FOLD_PRIORITY: readonly UnitTcStatus[] = ['FAIL', 'UNKNOWN', 'RUNNING', 'PENDING', 'SUCCESS'];

const foldPair = (a: UnitTcStatus, b: UnitTcStatus): UnitTcStatus =>
  FOLD_PRIORITY[Math.min(FOLD_PRIORITY.indexOf(a), FOLD_PRIORITY.indexOf(b))];

const toUnitStatus = (wire: string | null | undefined): UnitTcStatus | null => {
  if (!wire) return null;
  const upper = wire.toUpperCase() as UnitTcStatus;
  return CONTRACT_STATUSES.includes(upper) ? upper : 'UNKNOWN';
};

/**
 * Agent results → per-unit verdict map (FAIL-first fold). When `unitIds` is given,
 * results keyed on ids outside it are ignored — they belong to units this screen
 * doesn't row; without it (header tag) every reported id folds.
 */
export function foldAgentStatuses(
  agents: readonly Pick<TestConnectionAgentResult, 'resource_id' | 'connection_status'>[],
  unitIds?: ReadonlySet<string>,
): ReadonlyMap<string, UnitTcStatus> {
  const map = new Map<string, UnitTcStatus>();
  for (const agent of agents) {
    const id = agent.resource_id;
    if (!id || (unitIds && !unitIds.has(id))) continue;
    const status = toUnitStatus(agent.connection_status);
    if (!status) continue;
    const previous = map.get(id);
    map.set(id, previous ? foldPair(previous, status) : status);
  }
  return map;
}

export interface TcBuckets {
  total: number;
  ok: number;
  fail: number;
  running: number;
  /** PENDING reported by an agent. */
  waiting: number;
  /** Units with no agent report at all — NOT the same fact as PENDING. */
  unreported: number;
  /** Out-of-contract values; on a settled run these must be surfaced, not hidden. */
  unknown: number;
  /** ok+fail+unknown — what has actually been answered. */
  reported: number;
  /** reported/total — 100% only when every unit has answered. */
  pct: number;
}

export function computeTcBuckets(
  unitIds: readonly string[],
  statuses: ReadonlyMap<string, UnitTcStatus>,
): TcBuckets {
  let ok = 0;
  let fail = 0;
  let running = 0;
  let waiting = 0;
  let unknown = 0;
  let unreported = 0;
  for (const id of unitIds) {
    switch (statuses.get(id)) {
      case 'SUCCESS': ok += 1; break;
      case 'FAIL': fail += 1; break;
      case 'RUNNING': running += 1; break;
      case 'PENDING': waiting += 1; break;
      case 'UNKNOWN': unknown += 1; break;
      default: unreported += 1;
    }
  }
  const total = unitIds.length;
  const reported = ok + fail + unknown;
  return {
    total,
    ok,
    fail,
    running,
    waiting,
    unreported,
    unknown,
    reported,
    pct: total > 0 ? Math.round((reported / total) * 100) : 0,
  };
}

export type TcRunPhase = 'idle' | 'running' | 'success' | 'fail';

/**
 * The one-line fact sentence — states what was verified, never a fixed slogan
 * the data can contradict.
 */
export function tcSummarySentence(phase: TcRunPhase, buckets: TcBuckets): string {
  const { total, ok, fail, reported } = buckets;
  switch (phase) {
    case 'running':
      return `연결 테스트 진행 중 — ${reported}/${total} 대상 보고됨`;
    case 'success':
      return `리소스 ${total}개 모두 연결에 성공했어요`;
    case 'fail':
      return fail > 0
        ? `리소스 ${total}개 중 ${ok}개 연결 성공 — 실패 ${fail}건을 점검해 주세요`
        : `연결 테스트가 실패했어요 — 결과를 확인해 주세요`;
    default:
      return '연결 테스트 대기 중 — Run Test를 실행해 주세요';
  }
}

/** requested→completed elapsed, Korean short form ('58초', '1분 12초'). Either side missing → null. */
export function tcElapsedLabel(
  requestedAt: string | null | undefined,
  completedAt: string | null | undefined,
): string | null {
  if (!requestedAt || !completedAt) return null;
  const start = new Date(requestedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}
