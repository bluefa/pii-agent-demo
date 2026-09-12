/**
 * 「왜 아직 5단계인가」 — 연결 테스트 탭의 5단계 종료 조건 한 행 + 관리자의 「승인 요청」.
 *
 * 5단계(INSTALLED)를 끝내는 사건은 하나다: 5단계에서 「승인 요청」을 누르는 것
 * (PUT …/test-connection-acknowledgment). 연결 테스트 성공은 종료 조건이 아니라 그 버튼을
 * 누를 수 있는 전제이고, 관리자가 재실행을 요청하면(REJECTED) 요청이 도로 열린다. 그래서
 * 요건문은 하나이고(오너 2026-09-12 "5단계 조건은 그냥 승인 요청됨 아님?"), 왜 아직 안
 * 눌렸는지는 **태그 한 낱말**이 가른다. 근거 목록은 없다 — 관리자는 이 행에서 읽지 않고
 * 누른다(오너 2026-09-12 "아무 생각없이 누를 수 있게만").
 *
 * 누를 수 있는 조건은 **서비스 Step 5 의 정책 그대로**다(오너 2026-09-12 "기존 Step5 의
 * 정책과 동일"): `ConnectionTestCard` 의 `canRequestApproval` — 확정 단위가 있고 전부 연결
 * 성공, 실행 중이 아니고, completion-status 가 LATEST_TEST_CONNECTION_SUCCESS. 관리자라고
 * 실패한 실행이나 정책이 바뀐 뒤의 실행을 넘기지 않는다. 판정을 포크하지 않고 같은 훅
 * (`useTcCompletionStatus`)과 같은 버킷을 읽는다.
 *
 * 5단계가 아니면 아무것도 말하지 않는다(끝난 단계의 사유는 소식이 아니다). SDU 는 승인
 * 요청 버튼 자체가 없어 조건이 성립하지 않으므로 같이 뺀다(`sduHandoffGate` 와 같은 갈래).
 *
 * 어휘: 상태는 텍스트 태그(오너 2026-09-11). 버튼 이름은 서비스 쪽 그대로 「승인 요청」,
 * 반려는 승인 탭 알약과 같은 「재실행 요청됨」(approvalGate.ts). 실행 판정은 승인 조건 ②의
 * `tcRunGate` 를 그대로 쓴다 — 두 탭이 같은 실행을 다르게 부르지 않게.
 */
import type { TcBuckets } from '@/lib/test-connection-summary';
import type { TestConnectionCompletionStatus, TestConnectionVersionResult } from '@/app/lib/api';
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

/**
 * completion-status 의 세 얼굴 — 아직 안 왔다 / 못 읽었다 / 계약의 판정. 성공한 실행에서만
 * 묻는 값이라 그 밖의 국면에서는 무엇이 와도 읽지 않는다.
 */
export type CompletionRead =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; value: TestConnectionCompletionStatus['test_connection_status'] | null };

export interface StepHoldView {
  state: StepHoldState;
  /** 요건문 옆 상태 태그 — 왜 아직 안 눌렸는지(또는 눌렸는지)를 한 낱말로. */
  tag?: { tone: TcTone; label: string };
  /** 관리자가 지금 승인 요청을 보낼 수 있는가 — 서비스 Step 5 와 같은 게이트. */
  canRequest: boolean;
  /**
   * 버튼이 닫힌 이유 — 열려 있거나(canRequest) 버튼 자체가 없는 국면(요청됨 · 조회 중)이면
   * null. ⛔ 이유 없이 잠긴 버튼은 만들지 않는다 — 툴팁이 이 문장을 든다.
   */
  blockedHint: string | null;
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
  /** 확정 단위 기준 판정 분포 — 서비스 Step 5 의 `ok === total` 게이트가 읽는 그 수. */
  buckets: TcBuckets;
  completion: CompletionRead;
}

const HINT_RUN_FIRST = '연결 테스트가 성공해야 승인 요청을 보낼 수 있습니다';
const HINT_RERUN = '연결 테스트를 다시 실행해 성공해야 승인 요청을 보낼 수 있습니다';

const closed = (
  state: StepHoldState,
  blockedHint: string | null,
  tag?: StepHoldView['tag'],
): StepHoldView => ({ state, tag, canRequest: false, blockedHint });

/** 5단계가 아니거나 SDU 면 null — 호출자는 아무것도 그리지 않는다. */
export function stepHoldView(input: StepHoldInput): StepHoldView | null {
  const { processStatus, isSdu, statusLoaded, tcStatus, tcStatusFailed, latest, latestFailed, buckets, completion } = input;
  if (processStatus !== 'INSTALLED' || isSdu) return null;
  if (!statusLoaded) return closed('loading', null);
  if (tcStatusFailed) return closed('unknown', '승인 요청 상태를 확인하지 못했습니다');

  const status = tcStatus?.status ?? null;
  const requested = { tone: 'ok', label: '승인 요청됨' } as const;
  if (status === TC_COMPLETED) return closed('ok', null, requested);

  const gate = tcRunGate(runStatus(latest), latest !== null, latestFailed);
  switch (gate) {
    case 'error':
      return closed('unknown', '최신 연결 테스트 정보를 불러오지 못했습니다');
    case 'unknown':
      return closed('unknown', '연결 테스트 결과를 판정할 수 없습니다', { tone: 'off', label: '미확인' });
    case 'open':
      return closed('loading', '연결 테스트가 끝나야 승인 요청을 보낼 수 있습니다', { tone: 'warn', label: '진행 중' });
    case 'none':
      return closed('unmet', HINT_RUN_FIRST, { tone: 'off', label: '실행 없음' });
    case 'failed':
      return closed('unmet', HINT_RUN_FIRST, { tone: 'err', label: '연결 테스트 실패' });
    default:
      break;
  }

  // success — 서비스 Step 5 의 게이트를 그대로 건다. 태그는 "왜 아직 요청이 없는가"를
  // 말한다: 관리자가 돌려보냈거나(REJECTED), 그냥 아직 안 눌렀거나.
  const tag: StepHoldView['tag'] =
    status === TC_REJECTED ? { tone: 'warn', label: '재실행 요청됨' } : { tone: 'warn', label: '승인 요청 대기' };
  if (buckets.total === 0 || buckets.ok !== buckets.total) {
    return closed('unmet', '모든 리소스가 연결에 성공해야 승인 요청을 보낼 수 있습니다', {
      tone: 'warn',
      label: '일부 리소스 미확인',
    });
  }
  switch (completion.kind) {
    case 'loading':
      // 게이트의 마지막 답이 아직이다 — 열지도 잠그지도 않는다(버튼은 잠시 disabled).
      return { state: 'unmet', tag, canRequest: false, blockedHint: null };
    case 'failed':
      return closed('unmet', '승인 요청 가능 여부를 확인하지 못했습니다', tag);
    default:
      break;
  }
  switch (completion.value) {
    case 'LATEST_TEST_CONNECTION_SUCCESS':
      return { state: 'unmet', tag, canRequest: true, blockedHint: null };
    case 'CONFIRMED':
      // 계약이 이미 확인됐다고 답한다 — status 행이 늦게 따라오는 창. 요청됨으로 읽는다.
      return closed('ok', null, requested);
    case 'LOGICAL_DATABASE_RECENTLY_UPDATED':
      return closed('unmet', '논리 DB 정책이 마지막 실행 이후 바뀌었습니다. ' + HINT_RERUN, {
        tone: 'warn',
        label: '재실행 필요',
      });
    case 'TEST_CONNECTION_REQUIRED':
      return closed('unmet', HINT_RERUN, { tone: 'warn', label: '재실행 필요' });
    default:
      return closed('unknown', '승인 요청 가능 여부를 판정할 수 없습니다', tag);
  }
}
