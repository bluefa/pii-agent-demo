/**
 * Flow-header label model + task display-name resolution (pure, testable).
 * Wraps the derivations in lib/pipeline/format so the exact header grammar
 * lives in one tested place. (R20: the target-page status bar is gone —
 * currentTaskInfo drives the pipeline page's flow-card header rows.)
 */
import { currentTask, currentTaskLabel, fmtDateTimeSec, fmtDuration } from '@/lib/pipeline/format';
import type { PipelineStatus, TaskDetail, TaskSummary } from '@/lib/pipeline/types';

/** Minimal shape both TaskSummary and RecipePreviewStep-ish rows satisfy. */
interface NamedTask {
  task_definition: string;
  operation: string | null;
}

/**
 * Task display name (node / modal title / sb-cur). Precedence:
 *   loaded detail's definition display_name → task-catalog name → operation enum
 *   → task_definition. The last two are the summary-only fallbacks (target page,
 *   no catalog / detail) and match the prototype's `{operation}`.
 */
export function taskDisplayName(
  task: NamedTask,
  detail?: TaskDetail | null,
  catalog?: ReadonlyMap<string, string> | null,
): string {
  return (
    detail?.definition?.display_name ||
    catalog?.get(task.task_definition) ||
    task.operation ||
    task.task_definition
  );
}

/**
 * R18 §7-2 — structured zone2 model for the merged flow-card header. Splits the
 * flat sb-cur string into label(12/faint) / name(16/bold) / retry(12/weak)
 * tiers so the run level and the task level read as separate hierarchy.
 * (R19.6: no seq wording anywhere — the flow canvas carries the order.)
 */
export interface CurrentTaskInfo {
  /** Leading tier label — '현재 태스크' | '실패 태스크' | '시작 대기' | '결과'. */
  label: string;
  /** Task display name, schedule text, or terminal summary. */
  name: string;
  /** '재시도 f/m' (no parens) when the current task has failures, else null. */
  retry: string | null;
}

export function currentTaskInfo(
  status: PipelineStatus,
  nextDueAt: string | null,
  tasks: readonly TaskSummary[],
  resolveName: (task: TaskSummary) => string,
  retryFor?: (task: TaskSummary) => string | null,
): CurrentTaskInfo {
  if (status === 'PENDING') {
    // 초 단위까지 노출 — start-delay가 ~15초라 분 단위로는 "지금"과 구분되지 않는다(운영 피드백).
    return { label: '시작 대기', name: `${fmtDateTimeSec(nextDueAt)} 시작 예정`, retry: null };
  }
  const cur = currentTask(tasks);
  if (cur) {
    const retry = retryFor?.(cur) ?? '';
    return {
      label: cur.status === 'FAILED' ? '실패 태스크' : '현재 태스크',
      name: resolveName(cur),
      retry: retry ? retry.replace(/^\s*\(|\)\s*$/g, '') : null,
    };
  }
  return { label: '결과', name: currentTaskLabel(status, tasks), retry: null };
}

/** First FAILED task (drives the sb-err chip); null when none. */
export function findFailedTask(tasks: readonly TaskSummary[]): TaskSummary | null {
  return tasks.find((t) => t.status === 'FAILED') ?? null;
}

/** Retry suffix " (재시도 f/m)" for a task with fail_count > 0, else ''. */
export function retrySuffix(failCount: number, maxFail: number | null | undefined): string {
  if (!failCount || failCount <= 0) return '';
  return ` (재시도 ${failCount}/${maxFail ?? '?'})`;
}

/**
 * R23 (폴링 C안) — tasks whose summary moved enough to invalidate the loaded
 * detail (status or fail_count changed, or the task is new), by task_id.
 * Drives the "refetch only what changed" rule of the 10s poll.
 */
export function changedTaskIds(
  prev: readonly TaskSummary[],
  next: readonly TaskSummary[],
): number[] {
  const prevById = new Map(prev.map((t) => [t.task_id, t]));
  return next
    .filter((t) => {
      const p = prevById.get(t.task_id);
      return !p || p.status !== t.status || p.fail_count !== t.fail_count;
    })
    .map((t) => t.task_id);
}

/**
 * The Terraform execution limit in words — `30분 시간제한`. null when the task
 * detail that carries `effective_execution_timeout` is not loaded (or the
 * contract left it null): an unknown limit is not stated, not guessed.
 */
export function timeoutLimitLabel(executionTimeout: string | null | undefined): string | null {
  const duration = fmtDuration(executionTimeout);
  return duration === '-' ? null : `${duration} 시간제한`;
}

/** EXECUTION_TIMEOUT in words. 'FAILED' is the shape of every other failure too. */
export const TIMEOUT_VERDICT = '실행 시간 만료';

/** `실행 시간 만료 (30분 시간제한)`, or the bare verdict when the limit is unknown. */
export function timeoutLabel(executionTimeout: string | null | undefined): string {
  const limit = timeoutLimitLabel(executionTimeout);
  return limit ? `${TIMEOUT_VERDICT} (${limit})` : TIMEOUT_VERDICT;
}

/**
 * Failure-strip line 1, after the bold task name. EXECUTION_TIMEOUT did not fail
 * a job — it ran out of time, so a fail_count sentence would name the wrong
 * event; every other code keeps the count it earned. The code itself is not in
 * this line: the strip prints it as a chip beside it.
 */
export function failStripHeadline(
  failCount: number,
  errorCode: string | null,
  executionTimeout: string | null | undefined,
): string {
  if (errorCode === 'EXECUTION_TIMEOUT') return `태스크 ${timeoutLabel(executionTimeout)}`;
  return `태스크가 ${failCount}회 실패했습니다`;
}

/** Flow-node subtitle for a FAILED task — the same split, one tier shorter. */
export function failedTaskMeta(
  failCount: number,
  errorCode: string | null,
  executionTimeout: string | null | undefined,
): string {
  if (errorCode === 'EXECUTION_TIMEOUT') return timeoutLabel(executionTimeout);
  return `${failCount}회 실패했습니다. 원인은 ${errorCode ?? '기록되지 않았습니다'}.`;
}

/**
 * Drawer verdict summary — the job tally, and for EXECUTION_TIMEOUT the limit it
 * ran out of first (`30분 시간제한 · job 8개 중 5개 성공, 3개 timeout`). null when
 * there is nothing to say: no jobs and no known limit.
 */
export function verdictSummary(
  errorCode: string | null,
  executionTimeout: string | null | undefined,
  tally: string | null,
): string | null {
  if (errorCode !== 'EXECUTION_TIMEOUT') return tally;
  const parts = [timeoutLimitLabel(executionTimeout), tally].filter((p): p is string => p !== null);
  return parts.length === 0 ? null : parts.join(' · ');
}
