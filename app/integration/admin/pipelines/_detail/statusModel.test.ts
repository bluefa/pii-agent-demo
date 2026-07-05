import { describe, expect, it } from 'vitest';
import {
  findFailedTask,
  retrySuffix,
  statusCurrentText,
  taskDisplayName,
} from '@/app/integration/admin/pipelines/_detail/statusModel';
import type { TaskDetail, TaskSummary } from '@/lib/pipeline/types';

function mkTask(partial: Partial<TaskSummary> & Pick<TaskSummary, 'sequence' | 'status'>): TaskSummary {
  return {
    task_id: partial.task_id ?? partial.sequence,
    sequence: partial.sequence,
    kind: partial.kind ?? 'TERRAFORM_JOB',
    task_definition: partial.task_definition ?? `def_${partial.sequence}`,
    operation: partial.operation ?? null,
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

describe('statusCurrentText', () => {
  it('PENDING → 시작 대기 with the next_due_at (null renders "-")', () => {
    expect(statusCurrentText('PENDING', null, [], opName)).toBe('시작 대기 · - 시작 예정');
  });

  it('current task → 현재 seq {n} · {name}', () => {
    const tasks = [
      mkTask({ sequence: 0, status: 'DONE' }),
      mkTask({ sequence: 1, status: 'IN_PROGRESS', operation: 'AWS_SERVICE_TF_APPLY' }),
      mkTask({ sequence: 2, status: 'BLOCKED' }),
    ];
    expect(statusCurrentText('RUNNING', null, tasks, opName)).toBe('현재 seq 1 · AWS_SERVICE_TF_APPLY');
  });

  it('appends the retry suffix on the current task when provided', () => {
    const tasks = [mkTask({ sequence: 0, status: 'IN_PROGRESS', operation: 'NETWORK_READY', fail_count: 2 })];
    const text = statusCurrentText('RUNNING', null, tasks, opName, (t) =>
      retrySuffix(t.fail_count, 3),
    );
    expect(text).toBe('현재 seq 0 · NETWORK_READY (재시도 2/3)');
  });

  it('falls back to the terminal label when there is no current task', () => {
    const done = [mkTask({ sequence: 0, status: 'DONE' })];
    expect(statusCurrentText('DONE', null, done, opName)).toBe('완료');
    const cancelled = [mkTask({ sequence: 0, status: 'CANCELLED' })];
    expect(statusCurrentText('CANCELLED', null, cancelled, opName)).toBe('취소됨');
  });
});

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
