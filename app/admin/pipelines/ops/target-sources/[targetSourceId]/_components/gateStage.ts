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
  action: GateAction;
}

export function gateStage(
  processStatus: ProcessStatus | null,
  targetSourceId: number | string,
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
      return {
        sentence: '아직 확정된 연동 정보가 없습니다. 확정 정보 탭에서 확정하면 작업 시작이 열립니다.',
        action: {
          kind: 'tab',
          tab: OPS_TAB_SLUGS.confirm,
          label: `${OPS_TAB_SLUGS.confirm} 탭으로`,
        },
      };
  }
}
