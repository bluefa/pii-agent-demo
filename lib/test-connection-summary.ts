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
  };
}

export type TcRunPhase = 'idle' | 'queued' | 'running' | 'success' | 'fail';

/**
 * 시안 A display state: the run phase, refined by the completion-status verdict
 * once the run settles SUCCESS. The verdict only differentiates within SUCCESS —
 * while a test runs there is no verdict to consult (조회 보류), and an unsettled
 * or failed run reads as its phase alone.
 */
export type TcCardState = TcRunPhase | 'policy-changed' | 'confirmed';

export function foldTcCardState(
  phase: TcRunPhase,
  completion: string | null | undefined,
): TcCardState {
  if (phase !== 'success') return phase;
  if (completion === 'CONFIRMED') return 'confirmed';
  if (completion === 'LOGICAL_DATABASE_RECENTLY_UPDATED') return 'policy-changed';
  return 'success';
}

/**
 * The one-line verdict — states what was verified, never a fixed slogan the data
 * can contradict.
 *
 * 판정만 말하고 수를 세지 않는다. 개수는 바로 아래 카운트 줄이 점 범례와 함께 이미
 * 나르므로, 문장이 같은 숫자를 다시 쓰면 한 계층 위에서 축이 둘로 늘어난다 —
 * "리소스 4개 중 3개 연결 성공 — 실패 1건" 이 정확히 그 형태였다. "A — B" 로 이어
 * 붙이던 구조도 같이 걷는다: 사실을 나열하지 말고 계층으로 가른다.
 */
export function tcSummarySentence(state: TcCardState, buckets: TcBuckets): string {
  const { total, ok, fail, reported } = buckets;
  switch (state) {
    case 'queued':
      // top-level PENDING — 접수만 됐고 아무것도 돌지 않는다. "진행 중"이라고 말하면
      // 0% 빈 바와 함께 멈춘 것처럼 읽힌다(카운트 줄의 "대기"는 유닛 단위 PENDING 이라
      // 어휘를 "시작 대기"로 가른다).
      return '연결 테스트 시작을 기다리고 있어요';
    case 'running':
      // 시안 E — 모든 유닛이 답을 냈는데 실행은 아직 정착하지 않은 구간. 바는 가득 차
      // 있고 카운트 줄의 `남음` 도 사라진 뒤라, 문장까지 "진행 중" 이면 화면 전체가
      // 멈춘 것을 말한다. 스캔의 finalizing 프레임이 같은 자리에서 이미 쓰는 어휘다
      // (ScanRunningState: "리소스 탐색은 끝났고 결과를 집계하고 있어요").
      return total > 0 && reported === total
        ? '결과를 집계하고 있어요'
        : '연결 테스트 진행 중';
    case 'success':
      // 실행 판정(SUCCESS)과 유닛 접기가 어긋날 수 있다 — 마지막 실행 뒤 확정된
      // 리소스, 결과에 없는 유닛 id. "모두"는 카운트가 실제로 그럴 때만 말한다.
      if (ok === total) return '모든 리소스가 연결에 성공했어요';
      // 하나도 확인되지 않은 정착을 "일부"라고 부르면 실제보다 나아 보인다.
      return ok === 0
        ? '연결 결과가 확인된 리소스가 없어요'
        : '일부 리소스는 연결 결과가 확인되지 않았어요';
    case 'fail':
      if (fail > 0) return '연결에 실패한 리소스가 있어요';
      // 유닛 실패 카운트가 없는 실패(무보고 정착·계약 밖 값)도 사용자에겐 같은 실패다 —
      // 특수 상태를 발명하지 않는다(오너 결정). 원인은 계약에 없으므로 말하지 않는다.
      return '연결 테스트가 실패했어요';
    case 'policy-changed':
      return '논리 DB 정책이 마지막 실행 이후 변경됐어요';
    case 'confirmed':
      return '연결 테스트 완료 확인됨';
    default:
      // 결과 서술("성공 0")이 아니라 실행이 없다는 사실만 — 정답 행동은 옆의 슬롯 CTA가 든다.
      return '아직 실행한 연결 테스트가 없습니다';
  }
}

/**
 * requested→end elapsed, Korean short form ('58초', '1분 12초'). Either side missing → null.
 *
 * `end` 는 계약의 completed_at 이거나, 아직 끝나지 않은 실행을 재는 브라우저의 지금
 * (ms epoch)이다 — 진행 중 카드가 후자를 쓴다(시안 B). 서버 시각과 브라우저 시계가
 * 어긋나 end < start 로 읽히면 null 이라, 음수 경과가 화면에 서는 일은 없다.
 */
export function tcElapsedLabel(
  requestedAt: string | null | undefined,
  completedAt: string | number | null | undefined,
): string | null {
  if (!requestedAt || !completedAt) return null;
  const start = new Date(requestedAt).getTime();
  const end = typeof completedAt === 'number' ? completedAt : new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}
