/**
 * Status-bar label model + task display-name resolution (pure, testable).
 * Shared by the target page (summary + fetched detail) and the pipeline page
 * (full detail + task catalog). Wraps the derivations in lib/pipeline/format so
 * the exact sb-cur branch grammar lives in one tested place.
 */
import { currentTask, currentTaskLabel, fmtDateTime } from '@/lib/pipeline/format';
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
 * sb-cur text:
 *  - PENDING → "시작 대기 · {next_due_at|'-'} 시작 예정"
 *  - current task (lowest READY/IN_PROGRESS/FAILED) → "현재 seq {n} · {name}"
 *    (+ optional retry suffix on the pipeline page)
 *  - else → currentTaskLabel (완료 / 취소됨 / 실패 / 시작 대기)
 */
export function statusCurrentText(
  status: PipelineStatus,
  nextDueAt: string | null,
  tasks: readonly TaskSummary[],
  resolveName: (task: TaskSummary) => string,
  retryFor?: (task: TaskSummary) => string | null,
): string {
  if (status === 'PENDING') {
    return `시작 대기 · ${fmtDateTime(nextDueAt)} 시작 예정`;
  }
  const cur = currentTask(tasks);
  if (cur) {
    const retry = retryFor?.(cur) ?? '';
    return `현재 seq ${cur.sequence} · ${resolveName(cur)}${retry}`;
  }
  return currentTaskLabel(status, tasks);
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
