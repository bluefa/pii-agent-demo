// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineSummary } from '@/lib/pipeline/types';

const getLatestPipelineByTarget = vi.fn();
vi.mock('@/app/lib/api/pipeline', () => ({
  getLatestPipelineByTarget: (...args: unknown[]) => getLatestPipelineByTarget(...args),
}));

import { useLatestRun } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/useLatestRun';

const summary = (status: PipelineSummary['status']): PipelineSummary => ({
  pipeline_id: 135,
  type: 'RECONFIRM',
  target_source_id: '1388',
  service_code: 'bil',
  service_name: 'Billing',
  cloud_provider: 'AWS',
  recipe_definition: 'AWS_RECONFIRM_V1',
  status,
  done_task_count: 2,
  total_task_count: 5,
  created_at: '2026-09-12T10:58:00Z',
  last_activity_at: '2026-09-12T10:59:00Z',
});

describe('useLatestRun', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getLatestPipelineByTarget.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('204 (없음) 은 run 없음 · live 아님 · 폴링 없음', async () => {
    getLatestPipelineByTarget.mockResolvedValue(null);
    const { result } = renderHook(() => useLatestRun(1388, () => {}));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.run).toBeNull();
    expect(result.current.live).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getLatestPipelineByTarget).toHaveBeenCalledTimes(1);
  });

  it('진행 중이면 8초마다 다시 읽고, 끝나는 틱에 onSettled 를 한 번 부른다', async () => {
    const onSettled = vi.fn();
    getLatestPipelineByTarget.mockResolvedValue(summary('RUNNING'));
    const { result } = renderHook(() => useLatestRun(1388, onSettled));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.live).toBe(true);

    getLatestPipelineByTarget.mockResolvedValue(summary('DONE'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(result.current.live).toBe(false);
    expect(onSettled).toHaveBeenCalledTimes(1);

    // Terminal: the poll stops.
    const calls = getLatestPipelineByTarget.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getLatestPipelineByTarget.mock.calls.length).toBe(calls);
  });
});
