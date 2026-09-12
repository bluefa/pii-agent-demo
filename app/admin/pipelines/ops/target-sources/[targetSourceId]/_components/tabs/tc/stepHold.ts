/**
 * 「왜 아직 5단계인가」 — 연결 테스트 탭이 5단계 종료 조건 두 행으로 답하는 판정.
 *
 * 5단계(INSTALLED)가 끝나려면 둘이 있어야 한다:
 *   ① 최신 연결 테스트 결과가 성공
 *   ② 서비스 담당자가 5단계에서 「승인 요청」을 누름 (PUT …/test-connection-acknowledgment)
 * 관리자가 재실행을 요청하면(REJECTED) ②가 도로 열린다. 이 파일은 그 두 행의 판정과 근거를
 * 접는다 — 입력은 페이지가 이미 받는 세 값(process_status · tc status · latest)뿐이고,
 * 새 엔드포인트는 없다 (docs/ux/benchmark/step5-hold-reason.md).
 *
 * 5단계가 아니면 아무것도 말하지 않는다(끝난 단계의 사유는 소식이 아니다). SDU 는 승인
 * 요청 버튼 자체가 없어 ②가 성립하지 않으므로 같이 뺀다(`sduHandoffGate` 와 같은 갈래).
 *
 * 어휘: 한 줄에 사실 하나, 상태는 텍스트 태그(오너 2026-09-11). 버튼 이름은 서비스 쪽
 * 그대로 「승인 요청」, 반려는 승인 탭 알약과 같은 「재실행 요청됨」(approvalGate.ts).
 * 판정 ①은 승인 조건 ②의 `tcRunGate` 를 그대로 쓴다 — 두 탭이 같은 실행을 다르게 부르지 않게.
 */
import { fmtDateTimeShort } from '@/lib/pipeline/format';
import type { TcBuckets } from '@/lib/test-connection-summary';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import type { TcTone } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  TC_COMPLETED,
  TC_REJECTED,
  tcRunGate,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import { runStatus } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/**
 * 행의 판정 마크. `unmet` 만 ✗ 다 — `unknown` 은 모름이지 미충족이 아니고(승인 탭
 * GateCard 와 같은 규칙), `na` 는 앞 조건이 안 서서 아직 물을 수 없는 행이다.
 */
export type StepHoldRowState = 'ok' | 'unmet' | 'unknown' | 'loading' | 'na';

export interface StepHoldFact {
  /** 없으면 산문 줄 — 「다음에 누가 무엇을 하면 되는가」 같은 안내. */
  label?: string;
  value: string;
}

export interface StepHoldRow {
  state: StepHoldRowState;
  /** 요건문 옆 상태 태그 — 상태는 글자로 말한다. */
  tag?: { tone: TcTone; label: string };
  facts: readonly StepHoldFact[];
}

export interface StepHoldView {
  /** 머리 줄의 차례 문장 — 조회 중이면 null. */
  turn: string | null;
  run: StepHoldRow;
  ack: StepHoldRow;
}

export interface StepHoldInput {
  processStatus: ProcessStatus | null;
  isSdu: boolean;
  /** 페이지의 TC 조회(status + latest)가 한 번이라도 정착했는가. */
  statusLoaded: boolean;
  tcStatus: TestConnectionStatusRow | null;
  /** status 조회가 404 가 아닌 이유로 거절됐다 — 모름이지 미요청이 아니다. */
  tcStatusFailed: boolean;
  latest: TestConnectionVersionResult | null;
  latestFailed: boolean;
  buckets: TcBuckets;
}

const NEXT_RERUN_AND_REQUEST =
  '서비스 담당자가 연결 테스트를 다시 실행하고 승인 요청을 누르면 6단계로 넘어갑니다.';
const NEXT_REQUEST = '서비스 담당자가 5단계에서 승인 요청을 누르면 6단계로 넘어갑니다.';
const TURN_SERVICE = '지금은 서비스 담당자 차례입니다.';

const time = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const text = fmtDateTimeShort(iso);
  return text === '-' ? null : text;
};

/**
 * 반려가 최신 실행보다 앞선 사건인가. 승인 요청은 TargetSource 단위 한 건이라 서비스가
 * 다시 실행해도 REJECTED 가 남을 수 있다(#785 `ackIsStale`). 그때 반려는 새 실행의
 * 판정이 아니라 지난 실행의 기록이다.
 */
export function rejectionIsStale(
  rejectedAt: string | null | undefined,
  latest: TestConnectionVersionResult | null,
): boolean {
  if (!rejectedAt || !latest?.requested_at) return false;
  const rejected = new Date(rejectedAt).getTime();
  const requested = new Date(latest.requested_at).getTime();
  if (Number.isNaN(rejected) || Number.isNaN(requested)) return false;
  return requested > rejected;
}

/** 5단계가 아니거나 SDU 면 null — 호출자는 아무것도 그리지 않는다. */
export function stepHoldView(input: StepHoldInput): StepHoldView | null {
  const { processStatus, isSdu, statusLoaded, tcStatus, tcStatusFailed, latest, latestFailed, buckets } = input;
  if (processStatus !== 'INSTALLED' || isSdu) return null;
  if (!statusLoaded) {
    return {
      turn: null,
      run: { state: 'loading', facts: [] },
      ack: { state: 'loading', facts: [] },
    };
  }

  const gate = tcRunGate(runStatus(latest), latest !== null, latestFailed);
  const completedAt = time(latest?.completed_at);
  const requestedAt = time(latest?.requested_at);
  const counts = `성공 ${buckets.ok} · 실패 ${buckets.fail}`;

  const run = ((): StepHoldRow => {
    switch (gate) {
      case 'success':
        return {
          state: 'ok',
          facts: [
            ...(completedAt ? [{ label: '완료', value: completedAt }] : []),
            { label: '결과', value: counts },
          ],
        };
      case 'failed':
        return {
          state: 'unmet',
          tag: { tone: 'err', label: '실패' },
          facts: [
            ...(completedAt ? [{ label: '완료', value: completedAt }] : []),
            { label: '결과', value: counts },
            { value: '서비스 담당자가 원인을 고치고 연결 테스트를 다시 실행해야 합니다.' },
          ],
        };
      case 'open':
        return {
          state: 'loading',
          tag: { tone: 'warn', label: '진행 중' },
          facts: [
            ...(requestedAt ? [{ label: '요청', value: requestedAt }] : []),
            { value: '실행이 끝나면 결과가 여기 섭니다.' },
          ],
        };
      case 'none':
        return {
          state: 'unmet',
          tag: { tone: 'off', label: '실행 없음' },
          facts: [{ value: '서비스 담당자가 5단계에서 연결 테스트를 실행합니다.' }],
        };
      case 'error':
        return {
          state: 'unknown',
          facts: [{ value: '최신 연결 테스트 정보를 불러오지 못했습니다.' }],
        };
      default:
        // loading 은 위에서 걸렀고, 남는 것은 계약 밖 값이다 — 판정하지 않는다.
        return {
          state: 'unknown',
          tag: { tone: 'off', label: '미확인' },
          facts: [{ value: '연결 테스트 결과를 판정할 수 없습니다.' }],
        };
    }
  })();

  const ack = ((): StepHoldRow => {
    if (tcStatusFailed) {
      return { state: 'unknown', facts: [{ value: '승인 요청 상태를 불러오지 못했습니다.' }] };
    }
    const status = tcStatus?.status ?? null;
    if (status === TC_COMPLETED) {
      const at = time(tcStatus?.completedAt);
      return {
        state: 'ok',
        tag: { tone: 'ok', label: '승인 요청됨' },
        facts: [
          ...(at ? [{ label: '요청', value: at }] : []),
          { value: '단계 반영을 기다리고 있습니다.' },
        ],
      };
    }
    const rejectedAt = time(tcStatus?.rejectedAt);
    const rejected = status === TC_REJECTED;
    const stale = rejected && rejectionIsStale(tcStatus?.rejectedAt, latest);
    // 살아 있는 반려 — 최신 실행이 곧 관리자가 돌려보낸 그 실행이다.
    if (rejected && !stale) {
      return {
        state: 'unmet',
        tag: { tone: 'warn', label: '재실행 요청됨' },
        facts: [
          ...(rejectedAt ? [{ label: '재실행 요청', value: rejectedAt }] : []),
          ...(tcStatus?.rejectReason ? [{ label: '사유', value: tcStatus.rejectReason }] : []),
          { value: NEXT_RERUN_AND_REQUEST },
        ],
      };
    }
    // 미요청(404 포함) 또는 지난 실행의 반려. ①이 서야 물을 수 있는 행이다.
    const staleFact = stale && rejectedAt ? [{ label: '재실행 요청', value: `${rejectedAt} · 이전 실행 기준` }] : [];
    if (gate !== 'success') return { state: 'na', facts: staleFact };
    return {
      state: 'unmet',
      tag: { tone: 'warn', label: '승인 요청 대기' },
      facts: [...staleFact, { value: NEXT_REQUEST }],
    };
  })();

  const turn = ((): string | null => {
    if (run.state === 'unknown' || ack.state === 'unknown') return null;
    if (gate === 'open') return '연결 테스트가 끝나기를 기다리고 있습니다.';
    if (ack.state === 'ok') return '단계 반영을 기다리고 있습니다.';
    return TURN_SERVICE;
  })();

  return { turn, run, ack };
}
