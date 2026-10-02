// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDetail, TaskSummary } from '@/lib/pipeline/types';

const getTaskDetail = vi.fn();
vi.mock('@/app/lib/api/pipeline', () => ({
  getTaskDetail: (...args: unknown[]) => getTaskDetail(...args),
}));

import { useMissingTaskNames } from '@/app/admin/pipelines/_detail/useMissingTaskNames';

const task = (task_id: number, task_definition: string): TaskSummary => ({
  task_id,
  sequence: task_id,
  kind: 'HTTP_REQUEST',
  task_definition,
  operation: 'UNKNOWN',
  terraform_action: null,
  status: 'READY',
  fail_count: 0,
  error_code: null,
  consumes_terraform_slot: null,
  started_at: null,
  finished_at: null,
  description: null,
});

const TASKS = [task(1, 'AWS_SERVICE_APPLY_V1'), task(7, 'AWS_SERVICE_ACCOUNT_CREATE_V1')];

describe('useMissingTaskNames', () => {
  beforeEach(() => {
    getTaskDetail.mockReset();
    getTaskDetail.mockResolvedValue({ definition: { display_name: 'AWS Agent Service Account 생성' } } as TaskDetail);
  });

  it('waits for the catalog, then fetches one detail per definition it omits', async () => {
    const { result, rerender } = renderHook(
      ({ catalog }: { catalog: ReadonlyMap<string, unknown> | null }) => useMissingTaskNames(41, TASKS, catalog),
      { initialProps: { catalog: null as ReadonlyMap<string, unknown> | null } },
    );
    expect(getTaskDetail).not.toHaveBeenCalled();

    rerender({ catalog: new Map([['AWS_SERVICE_APPLY_V1', {}]]) });
    await act(async () => {});
    expect(getTaskDetail).toHaveBeenCalledTimes(1);
    expect(getTaskDetail).toHaveBeenCalledWith(41, '7');
    expect(result.current.get('AWS_SERVICE_ACCOUNT_CREATE_V1')).toBe('AWS Agent Service Account 생성');

    // A poll hands back new task objects for the same run — no refetch.
    rerender({ catalog: new Map([['AWS_SERVICE_APPLY_V1', {}]]) });
    await act(async () => {});
    expect(getTaskDetail).toHaveBeenCalledTimes(1);
  });

  it('fetches nothing when the catalog names every task', async () => {
    renderHook(() =>
      useMissingTaskNames(41, TASKS, new Map(TASKS.map((t) => [t.task_definition, {}]))),
    );
    await act(async () => {});
    expect(getTaskDetail).not.toHaveBeenCalled();
  });
});
