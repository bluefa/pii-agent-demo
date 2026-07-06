/**
 * Target-page install/delete/cancel gating (pure, testable).
 *
 * Mirrors `targetButtons(ts)` in design/pipeline/admin-pipeline.html:
 *  - An active run (latest status ∈ {RUNNING, PENDING}) locks install & delete
 *    (uniqueness / no double-run) and exposes cancel.
 *  - Otherwise `installed = process_status ∈ {CONNECTED, COMPLETED, INSTALLED}`
 *    decides which of install / delete is available.
 * `process_status` is the RAW upstream string (getProject collapses it, so the
 * page reads it off the raw target-source detail — see app/lib/api/pipeline-target).
 *
 * Tooltip + lock-caption copy is VERBATIM from the prototype.
 */
const INSTALLED_STATUSES: readonly string[] = ['CONNECTED', 'COMPLETED', 'INSTALLED'];

const LOCK_TITLE = '진행·대기 중 파이프라인이 있어 잠금(중복 방지)';

export interface TargetButtonState {
  install: boolean;
  delete: boolean;
  cancel: boolean;
  /** The active run's id (for opening the cancel modal), else null. */
  runId: number | null;
  installed: boolean;
  installTitle: string;
  deleteTitle: string;
  /** Right-aligned always-on caption explaining the current lock state. */
  lockMsg: string;
}

export function targetButtons(
  processStatus: string | null | undefined,
  activeRunId: number | null,
): TargetButtonState {
  if (activeRunId != null) {
    return {
      install: false,
      delete: false,
      cancel: true,
      runId: activeRunId,
      installed: INSTALLED_STATUSES.includes(String(processStatus)),
      installTitle: LOCK_TITLE,
      deleteTitle: LOCK_TITLE,
      lockMsg: '진행·대기 중 파이프라인이 있어 설치·삭제는 잠깁니다',
    };
  }

  const installed = INSTALLED_STATUSES.includes(String(processStatus));
  return {
    install: !installed,
    delete: installed,
    cancel: false,
    runId: null,
    installed,
    installTitle: !installed ? '설치 파이프라인을 시작합니다' : '이미 설치된 대상',
    deleteTitle: installed ? '삭제 파이프라인을 시작합니다' : '설치되지 않은 대상',
    lockMsg: installed ? '설치된 대상 — 삭제만 가능합니다' : '미설치 대상 — 설치만 가능합니다',
  };
}
