/**
 * Which type row is live once the 작업 시작 modal is open.
 *
 * There is no start gate any more (owner 2026-09-11): 작업 시작 is offered on every
 * target regardless of process status or confirmed data. The only judgement left
 * here is per type row, below.
 */
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';

/**
 * Once the modal is open, which type row is live.
 *
 * The RECONFIRM row is always offered (owner, 09-11). The 재확정 door in the 확정
 * 정보 tab is open whenever no pipeline is running on the target, so the modal that
 * door leads to has to carry the row too — otherwise the door opens onto a modal
 * without the move it promised.
 *
 * What is left for this gate is the one status where INSTALL lies: CONFIRMING with
 * confirmed infra already standing. The confirmed data has to be entered again, but
 * the previous confirmation still occupies that slot, so re-running 설치 cannot
 * change it (ADR-023). INSTALL is blocked there and the sentence says why.
 *
 * ⛔ `hasConfirmedInfra === null` is not "no" — it means terraform-status has not
 * been read yet. Nothing is blocked on the strength of a value we failed to read
 * (same rule as the tab's other loads).
 */
export interface PipelineTypeGate {
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
    return { installBlocked: INSTALL_BLOCKED_BY_RECONFIRM };
  }
  return { installBlocked: null };
}
