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

/**
 * R18 §7-2 — structured zone2 model for the merged flow-card header. Splits the
 * flat sb-cur string into label(12/faint) / name(14/strong) / retry(12/weak)
 * tiers so the run level and the task level read as separate hierarchy.
 */
export interface CurrentTaskInfo {
  /** Leading tier label — '현재 태스크' | '실패 태스크' | '시작 대기' | '결과'. */
  label: string;
  /** Task display name, schedule text, or terminal summary. */
  name: string;
  /** '재시도 f/m' (no parens) when the current task has failures, else null. */
  retry: string | null;
  /** Current task sequence (0-base wire value), null when not task-scoped. */
  seq: number | null;
}

export function currentTaskInfo(
  status: PipelineStatus,
  nextDueAt: string | null,
  tasks: readonly TaskSummary[],
  resolveName: (task: TaskSummary) => string,
  retryFor?: (task: TaskSummary) => string | null,
): CurrentTaskInfo {
  if (status === 'PENDING') {
    return { label: '시작 대기', name: `${fmtDateTime(nextDueAt)} 시작 예정`, retry: null, seq: null };
  }
  const cur = currentTask(tasks);
  if (cur) {
    const retry = retryFor?.(cur) ?? '';
    return {
      label: cur.status === 'FAILED' ? '실패 태스크' : '현재 태스크',
      name: resolveName(cur),
      retry: retry ? retry.replace(/^\s*\(|\)\s*$/g, '') : null,
      seq: cur.sequence,
    };
  }
  return { label: '결과', name: currentTaskLabel(status, tasks), retry: null, seq: null };
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
