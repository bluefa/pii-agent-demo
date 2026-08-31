import { describe, expect, it } from 'vitest';
import {
  changedTaskIds,
  currentTaskInfo,
  failedTaskMeta,
  failStripHeadline,
  findFailedTask,
  retrySuffix,
  taskDisplayName,
  timeoutLabel,
  timeoutLimitLabel,
  verdictSummary,
} from '@/app/admin/pipelines/_detail/statusModel';
import type { TaskDetail, TaskSummary } from '@/lib/pipeline/types';

function mkTask(partial: Partial<TaskSummary> & Pick<TaskSummary, 'sequence' | 'status'>): TaskSummary {
  return {
    task_id: partial.task_id ?? partial.sequence,
    sequence: partial.sequence,
    kind: partial.kind ?? 'TERRAFORM_JOB',
    task_definition: partial.task_definition ?? `def_${partial.sequence}`,
    operation: partial.operation ?? null,
    terraform_action: partial.terraform_action ?? null,
    status: partial.status,
    fail_count: partial.fail_count ?? 0,
    error_code: partial.error_code ?? null,
    consumes_terraform_slot: partial.consumes_terraform_slot ?? null,
    started_at: partial.started_at ?? null,
    finished_at: partial.finished_at ?? null,
    description: partial.description ?? null,
  };
}

const opName = (t: TaskSummary): string => t.operation ?? t.task_definition;

describe('taskDisplayName — precedence', () => {
  const task = mkTask({ sequence: 0, status: 'READY', task_definition: 'aws_service_apply', operation: 'AWS_SERVICE_TF_APPLY' });

  it('prefers the loaded detail definition display_name', () => {
    const detail = { definition: { display_name: 'AWS 서비스 apply' } } as TaskDetail;
    const catalog = new Map([['aws_service_apply', 'catalog name']]);
    expect(taskDisplayName(task, detail, catalog)).toBe('AWS 서비스 apply');
  });

  it('falls back to the catalog name, then operation, then task_definition', () => {
    const catalog = new Map([['aws_service_apply', 'catalog name']]);
    expect(taskDisplayName(task, null, catalog)).toBe('catalog name');
    expect(taskDisplayName(task, null, null)).toBe('AWS_SERVICE_TF_APPLY'); // operation
    const noOp = mkTask({ sequence: 0, status: 'READY', task_definition: 'bare_def', operation: null });
    expect(taskDisplayName(noOp, null, null)).toBe('bare_def'); // task_definition
  });
});

describe('retrySuffix', () => {
  it('is empty when fail_count is 0', () => {
    expect(retrySuffix(0, 3)).toBe('');
  });
  it('renders f/m, with "?" for an unknown max', () => {
    expect(retrySuffix(2, 3)).toBe(' (재시도 2/3)');
    expect(retrySuffix(1, undefined)).toBe(' (재시도 1/?)');
  });
});

describe('findFailedTask', () => {
  it('returns the first FAILED task, else null', () => {
    const tasks = [
      mkTask({ sequence: 0, status: 'DONE' }),
      mkTask({ sequence: 1, status: 'FAILED', error_code: 'JOB_FAILED' }),
    ];
    expect(findFailedTask(tasks)?.sequence).toBe(1);
    expect(findFailedTask([mkTask({ sequence: 0, status: 'DONE' })])).toBeNull();
  });
});

// R18 §7-2 — structured zone2 model for the merged flow-card header.
describe('currentTaskInfo', () => {
  it('PENDING → 시작 대기 label + schedule name, no task scope', () => {
    const info = currentTaskInfo('PENDING', null, [], opName);
    expect(info).toEqual({ label: '시작 대기', name: '- 시작 예정', retry: null });
  });

  it('PENDING schedule time carries seconds (start-delay is second-scale)', () => {
    const info = currentTaskInfo('PENDING', '2026-06-30T05:02:17Z', [], opName);
    expect(info.name).toBe('2026-06-30 14:02:17 시작 예정');
  });

  it('current task → 현재 태스크 label + name (retry stripped of parens)', () => {
    const tasks = [
      mkTask({ sequence: 0, status: 'DONE' }),
      mkTask({ sequence: 1, status: 'IN_PROGRESS', operation: 'AWS_SERVICE_TF_APPLY', fail_count: 1 }),
    ];
    const info = currentTaskInfo('RUNNING', null, tasks, opName, (t) => retrySuffix(t.fail_count, 3));
    expect(info.label).toBe('현재 태스크');
    expect(info.name).toBe('AWS_SERVICE_TF_APPLY');
    expect(info.retry).toBe('재시도 1/3');
  });

  it('FAILED current task → 실패 태스크 label', () => {
    const tasks = [mkTask({ sequence: 0, status: 'FAILED', operation: 'AZURE_BDC_TF_APPLY' })];
    const info = currentTaskInfo('FAILED', null, tasks, opName);
    expect(info.label).toBe('실패 태스크');
    expect(info.name).toBe('AZURE_BDC_TF_APPLY');
  });

  it('terminal without a current task → 결과 label + summary text', () => {
    const tasks = [mkTask({ sequence: 0, status: 'DONE' })];
    const info = currentTaskInfo('DONE', null, tasks, opName);
    expect(info.label).toBe('결과');
    expect(info.retry).toBeNull();
  });
});

describe('changedTaskIds — R23 polling diff', () => {
  it('returns tasks whose status or fail_count moved, and new tasks', () => {
    const prev = [
      mkTask({ sequence: 0, status: 'DONE' }),
      mkTask({ sequence: 1, status: 'IN_PROGRESS', fail_count: 0 }),
      mkTask({ sequence: 2, status: 'BLOCKED' }),
    ];
    const next = [
      mkTask({ sequence: 0, status: 'DONE' }), // unchanged
      mkTask({ sequence: 1, status: 'IN_PROGRESS', fail_count: 1 }), // fail_count moved
      mkTask({ sequence: 2, status: 'READY' }), // status moved
      mkTask({ sequence: 3, status: 'BLOCKED' }), // new task
    ];
    expect(changedTaskIds(prev, next)).toEqual([1, 2, 3]);
  });

  it('returns [] when nothing moved', () => {
    const tasks = [mkTask({ sequence: 0, status: 'DONE' }), mkTask({ sequence: 1, status: 'READY' })];
    expect(changedTaskIds(tasks, tasks)).toEqual([]);
  });
});

describe('EXECUTION_TIMEOUT copy', () => {
  it('states the contract limit when the task detail carrying it is loaded', () => {
    expect(timeoutLimitLabel('PT30M')).toBe('30분 시간제한');
    expect(timeoutLabel('PT30M')).toBe('실행 시간 만료 (30분 시간제한)');
    expect(timeoutLabel('PT1H30M')).toBe('실행 시간 만료 (1시간 30분 시간제한)');
  });

  it('drops the parenthetical rather than guessing an unknown limit', () => {
    expect(timeoutLimitLabel(null)).toBeNull();
    expect(timeoutLimitLabel(undefined)).toBeNull();
    expect(timeoutLabel(null)).toBe('실행 시간 만료');
    expect(timeoutLabel('nonsense')).toBe('실행 시간 만료');
  });

  it('names the expiry instead of a fail_count in the strip and the node', () => {
    expect(failStripHeadline(1, 'EXECUTION_TIMEOUT', 'PT30M')).toBe('태스크 실행 시간 만료 (30분 시간제한)');
    expect(failStripHeadline(1, 'EXECUTION_TIMEOUT', null)).toBe('태스크 실행 시간 만료');
    expect(failedTaskMeta(1, 'EXECUTION_TIMEOUT', 'PT30M')).toBe('실행 시간 만료 (30분 시간제한)');
  });

  it('leaves every other code on the count sentence it earned', () => {
    expect(failStripHeadline(3, 'JOB_FAILED', 'PT30M')).toBe('태스크가 3회 실패했습니다');
    expect(failedTaskMeta(3, 'JOB_FAILED', 'PT30M')).toBe('3회 실패했습니다. 원인은 JOB_FAILED.');
    expect(failedTaskMeta(1, null, 'PT30M')).toBe('1회 실패했습니다. 원인은 기록되지 않았습니다.');
  });
});

describe('verdictSummary', () => {
  const tally = 'job 8개 중 5개 성공, 3개 timeout';

  it('puts the limit before the tally for an expiry', () => {
    expect(verdictSummary('EXECUTION_TIMEOUT', 'PT30M', tally)).toBe(`30분 시간제한 · ${tally}`);
    expect(verdictSummary('EXECUTION_TIMEOUT', null, tally)).toBe(tally);
    expect(verdictSummary('EXECUTION_TIMEOUT', 'PT30M', null)).toBe('30분 시간제한');
    expect(verdictSummary('EXECUTION_TIMEOUT', null, null)).toBeNull();
  });

  it('is the tally alone for every other code', () => {
    expect(verdictSummary('JOB_FAILED', 'PT30M', tally)).toBe(tally);
    // A dispatch failure observed no jobs — nothing to count, so nothing is said.
    expect(verdictSummary('CHECK_ERROR', 'PT30M', null)).toBeNull();
  });
});
