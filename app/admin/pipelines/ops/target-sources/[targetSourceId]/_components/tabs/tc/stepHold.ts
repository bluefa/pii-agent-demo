/**
 * 「왜 아직 5단계인가」 — 연결 테스트 탭이 5단계 종료 조건 한 행으로 답하는 판정.
 *
 * 5단계(INSTALLED)를 끝내는 사건은 하나다: 서비스 담당자가 5단계에서 「승인 요청」을 누르는
 * 것(PUT …/test-connection-acknowledgment). 연결 테스트 성공은 종료 조건이 아니라 그 버튼을
 * 누를 수 있는 전제이고, 관리자가 재실행을 요청하면(REJECTED) 요청이 도로 열린다. 그래서
 * 요건문은 하나이고(오너 2026-09-12 "5단계 조건은 그냥 승인 요청됨 아님?"), 왜 아직 안
 * 눌렸는지는 **태그**가 가른다 — 실행 없음 · 진행 중 · 연결 테스트 실패 · 재실행 요청됨 ·
 * 승인 요청 대기. 입력은 페이지가 이미 받는 세 값(process_status · tc status · latest)뿐이고,
 * 새 엔드포인트는 없다 (docs/ux/benchmark/step5-hold-reason.md).
 *
 * 5단계가 아니면 아무것도 말하지 않는다(끝난 단계의 사유는 소식이 아니다). SDU 는 승인
 * 요청 버튼 자체가 없어 조건이 성립하지 않으므로 같이 뺀다(`sduHandoffGate` 와 같은 갈래).
 *
 * 어휘: 한 줄에 사실 하나, 상태는 텍스트 태그(오너 2026-09-11). 버튼 이름은 서비스 쪽
 * 그대로 「승인 요청」, 반려는 승인 탭 알약과 같은 「재실행 요청됨」(approvalGate.ts).
 * 실행 판정은 승인 조건 ②의 `tcRunGate` 를 그대로 쓴다 — 두 탭이 같은 실행을 다르게 부르지 않게.
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
 * 판정 마크. `unmet` 만 ✗ 다 — `unknown` 은 모름이지 미충족이 아니고(승인 탭 GateCard 와
 * 같은 규칙), `loading` 은 아직 답이 없는 자리(조회 중 · 실행 진행 중)다.
 */
export type StepHoldState = 'ok' | 'unmet' | 'unknown' | 'loading';

export interface StepHoldFact {
  /** 없으면 산문 줄 — 「다음에 누가 무엇을 하면 되는가」 같은 안내. */
  label?: string;
  value: string;
}

export interface StepHoldView {
  /** 머리 줄의 차례 문장 — 조회 중·모름이면 null. */
  turn: string | null;
  state: StepHoldState;
  /** 요건문 옆 상태 태그 — 왜 아직 안 눌렸는지(또는 눌렸는지)를 글자로. */
  tag?: { tone: TcTone; label: string };
  facts: readonly StepHoldFact[];
  /**
   * 관리자가 서비스 담당자를 대신해 승인 요청을 보낼 수 있는가 — 최신 실행이 성공이고
   * 아직 요청되지 않았을 때(오너 2026-09-12 "Admin 페이지에서도 누를 수 있게"). 서비스
   * 화면의 게이트와 같은 전제(성공한 실행)라, 관리자라고 실패한 실행을 넘기진 않는다.
   */
  canRequest: boolean;
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
  const closed = { canRequest: false } as const;
  if (!statusLoaded) return { turn: null, state: 'loading', facts: [], ...closed };

  if (tcStatusFailed) {
    return {
      turn: null,
      state: 'unknown',
      facts: [{ value: '승인 요청 상태를 불러오지 못했습니다.' }],
      ...closed,
    };
  }

  const status = tcStatus?.status ?? null;
  if (status === TC_COMPLETED) {
    const at = time(tcStatus?.completedAt);
    return {
      turn: '단계 반영을 기다리고 있습니다.',
      state: 'ok',
      tag: { tone: 'ok', label: '승인 요청됨' },
      facts: [...(at ? [{ label: '요청', value: at }] : []), { value: '단계 반영을 기다리고 있습니다.' }],
      ...closed,
    };
  }

  const gate = tcRunGate(runStatus(latest), latest !== null, latestFailed);
  const completedAt = time(latest?.completed_at);
  const requestedAt = time(latest?.requested_at);
  const runFacts: StepHoldFact[] = [
    ...(completedAt ? [{ label: '완료', value: completedAt }] : []),
    { label: '결과', value: `성공 ${buckets.ok} · 실패 ${buckets.fail}` },
  ];

  switch (gate) {
    case 'error':
      return {
        turn: null,
        state: 'unknown',
        facts: [{ value: '최신 연결 테스트 정보를 불러오지 못했습니다.' }],
        ...closed,
      };
    case 'unknown':
      return {
        turn: null,
        state: 'unknown',
        tag: { tone: 'off', label: '미확인' },
        facts: [{ value: '연결 테스트 결과를 판정할 수 없습니다.' }],
        ...closed,
      };
    case 'open':
      return {
        turn: '연결 테스트가 끝나기를 기다리고 있습니다.',
        state: 'loading',
        tag: { tone: 'warn', label: '진행 중' },
        facts: [
          ...(requestedAt ? [{ label: '요청', value: requestedAt }] : []),
          { value: '실행이 끝나고 성공하면 승인 요청을 할 수 있습니다.' },
        ],
        ...closed,
      };
    case 'none':
      return {
        turn: TURN_SERVICE,
        state: 'unmet',
        tag: { tone: 'off', label: '실행 없음' },
        facts: [{ value: '서비스 담당자가 5단계에서 연결 테스트를 실행하고 승인 요청을 눌러야 합니다.' }],
        ...closed,
      };
    case 'failed':
      return {
        turn: TURN_SERVICE,
        state: 'unmet',
        tag: { tone: 'err', label: '연결 테스트 실패' },
        facts: [
          ...runFacts,
          { value: '서비스 담당자가 원인을 고치고 다시 실행한 뒤 승인 요청을 눌러야 합니다.' },
        ],
        ...closed,
      };
    default: {
      // success — 버튼을 누를 수 있는 상태인데 아직 안 눌렸다. 관리자가 대신 누를 수 있다.
      const rejectedAt = time(tcStatus?.rejectedAt);
      const rejected = status === TC_REJECTED;
      if (rejected && !rejectionIsStale(tcStatus?.rejectedAt, latest)) {
        // 살아 있는 반려 — 최신 실행이 곧 관리자가 돌려보낸 그 실행이다.
        return {
          turn: TURN_SERVICE,
          state: 'unmet',
          tag: { tone: 'warn', label: '재실행 요청됨' },
          facts: [
            ...runFacts,
            ...(rejectedAt ? [{ label: '재실행 요청', value: rejectedAt }] : []),
            ...(tcStatus?.rejectReason ? [{ label: '사유', value: tcStatus.rejectReason }] : []),
            { value: NEXT_RERUN_AND_REQUEST },
          ],
          canRequest: true,
        };
      }
      // 미요청(404 포함) 또는 지난 실행의 반려.
      return {
        turn: TURN_SERVICE,
        state: 'unmet',
        tag: { tone: 'warn', label: '승인 요청 대기' },
        facts: [
          ...runFacts,
          ...(rejected && rejectedAt
            ? [{ label: '재실행 요청', value: `${rejectedAt} · 이전 실행 기준` }]
            : []),
          { value: NEXT_REQUEST },
        ],
        canRequest: true,
      };
    }
  }
}
