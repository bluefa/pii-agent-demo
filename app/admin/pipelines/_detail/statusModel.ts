/**
 * Flow-header label model + task display-name resolution (pure, testable).
 * Wraps the derivations in lib/pipeline/format so the exact header grammar
 * lives in one tested place. (R20: the target-page status bar is gone —
 * currentTaskInfo drives the pipeline page's flow-card header rows.)
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
    return { label: '시작 대기', name: `${fmtDateTime(nextDueAt)} 시작 예정`, retry: null };
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
