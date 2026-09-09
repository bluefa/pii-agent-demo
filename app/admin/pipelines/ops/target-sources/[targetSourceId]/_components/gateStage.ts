/**
 * Why 작업 시작 is closed right now, and the ONE move that opens it.
 *
 * The 인프라 작업 tab can only run Terraform against confirmed integration data.
 * Before this existed the tab said the same thing twice — a banner in the head
 * and a reason line under a dead button — and both said only "확정된 연동 정보가
 * 없습니다", which is the symptom, not the step the operator is actually waiting
 * on. This maps the process status to the stage it really is at, so the sentence
 * names the next hand-off instead of the missing row.
 *
 * Allowlist, not a negative predicate: only the two stages that are genuinely
 * upstream of 확정 (IDLE = the service owner is still choosing, PENDING = the
 * request is waiting for approval) get their own sentence. Every other status —
 * including an unknown one and `null` (the process-status lookup failed) — falls
 * through to 확정 정보, which is the correct destination for anything at or past
 * CONFIRMING. A `!== 'IDLE'` style test would silently adopt whatever the wire
 * adds next.
 */
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { OPS_TAB_SLUGS, passRoutes, type OpsTargetTabLabel } from '@/lib/routes';

/**
 * The single next move. Discriminated so the caller can render the right control
 * without inspecting the payload: an `href` leaves this console for the screen
 * the service owner works in, a `tab` stays here and switches tabs.
 */
export type GateAction =
  | { kind: 'href'; href: string; label: string }
  | { kind: 'tab'; tab: OpsTargetTabLabel; label: string };

export interface GateStage {
  /** One sentence: what is happening, and what opens 작업 시작. */
  sentence: string;
  /**
   * The move, when there is one to offer. Absent on SDU's 확정 대기: 확정 정보 탭은
   * 그 대상에서 읽기 전용이라(계약에 쓰기 path 가 없다) 보내 봐야 누를 것이 없고,
   * 누를 것이 없는 곳으로 보내는 버튼은 버튼이 없는 것보다 나쁘다.
   */
  action?: GateAction;
}

export function gateStage(
  processStatus: ProcessStatus | null,
  targetSourceId: number | string,
  /**
   * SDU 대상인가 — 부르는 쪽이 판정해 내려준다. 마지막 갈래의 **문장이 바뀐다**: 다른
   * 대상에서는 관리자가 확정 정보 탭에서 직접 확정할 수 있어 그 지시가 참이지만, SDU 에는
   * 그 쓰기 경로가 없다. 그래서 지시 대신 **무엇을 기다리는지**만 말한다. 기다림의 주체가
   * 누구인지는 적지 않는다 — 계약이 SDU 의 확정 정보를 아직 정의하지 않았다(§9.2).
   */
  isSdu: boolean,
): GateStage {
  switch (processStatus) {
    case 'IDLE':
      return {
        sentence: '담당자가 연동 대상을 고르는 중입니다. 확정되면 여기서 작업 시작이 열립니다.',
        action: {
          kind: 'href',
          href: passRoutes.targetSource(targetSourceId),
          label: '서비스 담당자가 보는 화면',
        },
      };
    case 'PENDING':
      return {
        sentence: '연동 요청이 승인을 기다립니다. 승인·확정 후 작업 시작이 열립니다.',
        action: {
          kind: 'tab',
          tab: OPS_TAB_SLUGS.approval,
          label: `${OPS_TAB_SLUGS.approval} 탭으로`,
        },
      };
    default:
      return isSdu
        ? { sentence: '아직 확정된 연동 정보가 없습니다. 확정되면 여기서 작업 시작이 열립니다.' }
        : {
            sentence: '아직 확정된 연동 정보가 없습니다. 확정 정보 탭에서 확정하면 작업 시작이 열립니다.',
            action: {
              kind: 'tab',
              tab: OPS_TAB_SLUGS.confirm,
              label: `${OPS_TAB_SLUGS.confirm} 탭으로`,
            },
          };
  }
}

// ---------------------------------------------------------------------------
// 작업 유형 행 게이트 — 어떤 유형을 이 대상에서 지금 고를 수 있는가
// ---------------------------------------------------------------------------

/**
 * `gateStage` 위쪽은 **작업 시작 자체**가 닫힌 이유를 말한다. 여기는 그 다음 질문이다:
 * 모달이 열렸을 때 **어느 유형 행**이 살아 있는가.
 *
 * 한 상태에서만 답이 달라진다 — 3단계(`CONFIRMING`)에 확정된 인프라가 이미 있는 대상.
 * 확정 정보가 다시 들어와야 하는데 그 자리에 지난 확정이 서 있으므로, 설치를 다시 돌려도
 * 그 확정을 바꾸지 못한다(ADR-023). 그래서 그 대상에서 열리는 것은 재확정이고, 설치는
 * 눌러도 될 것 같은 얼굴로 남겨 두지 않는다.
 *
 * 재확정은 그 밖의 상태에서 **아예 그리지 않는다**. 비활성 행으로 남기면 「지금은 못
 * 한다」로 읽히지만 실제로는 이 대상에서 할 일이 아니고, 서버도 그 조합의 레시피를 갖고
 * 있지 않다.
 *
 * ⛔ `hasConfirmedInfra === null` 은 「없다」가 아니다 — terraform-status 를 아직 못
 * 읽었다는 뜻이다. 못 읽은 것을 근거로 행을 지우거나 막지 않는다(`startGate` 와 같은 규칙).
 */
export interface PipelineTypeGate {
  /** RECONFIRM 행을 그리는가. false 면 렌더 자체를 하지 않는다. */
  reconfirm: boolean;
  /** null 이 아니면 INSTALL 행이 막히고, 이 문장이 그 이유다. */
  installBlocked: string | null;
}

/** 3단계에 선 확정 인프라 위로 설치를 다시 돌려도 확정 정보는 바뀌지 않는다. */
const INSTALL_BLOCKED_BY_RECONFIRM =
  '확정 정보를 다시 입력해야 합니다. 재확정을 먼저 실행하세요.';

export function pipelineTypeGate(
  processStatus: ProcessStatus | null,
  /** `TerraformStatusResponse.has_confirmed_infra`; null = 아직 못 읽었다. */
  hasConfirmedInfra: boolean | null,
): PipelineTypeGate {
  if (processStatus === 'CONFIRMING' && hasConfirmedInfra === true) {
    return { reconfirm: true, installBlocked: INSTALL_BLOCKED_BY_RECONFIRM };
  }
  return { reconfirm: false, installBlocked: null };
}
