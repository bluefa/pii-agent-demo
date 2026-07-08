import { describe, expect, it } from 'vitest';
import type { PipelineStatus, PipelineSummary } from '@/lib/pipeline/types';
import {
  latestCellState,
  runWithConcurrency,
  serviceItemsFrom,
} from '@/app/integration/admin/pipelines/_services/logic';

const summary = (status: PipelineStatus): PipelineSummary => ({
  pipeline_id: 1,
  type: 'INSTALL',
  target_source_id: '101',
  service_code: 'SVC-000',
  service_name: '테스트 서비스',
  cloud_provider: 'AWS',
  recipe_definition: 'AWS_INSTALL_V1',
  status,
  done_task_count: 0,
  total_task_count: 3,
  created_at: '2026-07-01T00:00:00Z',
  last_activity_at: '2026-07-01T00:00:00Z',
});

describe('latestCellState', () => {
  it('undefined → loading', () => {
    expect(latestCellState(undefined)).toEqual({ kind: 'loading' });
  });

  it('null → idle', () => {
    expect(latestCellState(null)).toEqual({ kind: 'idle' });
  });

  it('RUNNING / PENDING → active with the id', () => {
    expect(latestCellState(summary('RUNNING'))).toEqual({
      kind: 'active',
      status: 'RUNNING',
      pipelineId: 1,
    });
    expect(latestCellState(summary('PENDING')).kind).toBe('active');
  });

  it('terminal statuses → idle', () => {
    for (const status of ['DONE', 'FAILED', 'CANCELLED'] as PipelineStatus[]) {
      expect(latestCellState(summary(status))).toEqual({ kind: 'idle' });
    }
  });
});

describe('serviceItemsFrom', () => {
  it('returns [] for null page or null content', () => {
    expect(serviceItemsFrom(null)).toEqual([]);
    expect(serviceItemsFrom({ content: null } as never)).toEqual([]);
  });

  it('returns the content array when present', () => {
    const page = { content: [{ service_code: 'A', service_name: 'a' }] } as never;
    expect(serviceItemsFrom(page)).toHaveLength(1);
  });
});

describe('runWithConcurrency', () => {
  it('runs every item and never exceeds the concurrency cap', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    const seen: number[] = [];
    await runWithConcurrency(items, 6, async (item) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      seen.push(item);
      inFlight -= 1;
    });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
    expect(maxInFlight).toBeLessThanOrEqual(6);
  });

  it('resolves immediately for an empty list', async () => {
    await expect(runWithConcurrency([], 6, async () => {})).resolves.toBeUndefined();
  });

  it('stops launching new tasks once shouldContinue returns false', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const started: number[] = [];
    let cancelled = false;
    await runWithConcurrency(
      items,
      2,
      async (item) => {
        started.push(item);
        await Promise.resolve();
        // Simulate the effect cleanup firing mid-batch.
        if (item === 3) cancelled = true;
      },
      () => !cancelled,
    );
    // Items after the cancellation point were never started (in-flight ones finish).
    expect(started.length).toBeLessThan(items.length);
    expect(started).not.toContain(9);
  });

  it('launches nothing when shouldContinue is false from the start', async () => {
    const started: number[] = [];
    await runWithConcurrency(
      [1, 2, 3],
      6,
      async (item) => {
        started.push(item);
      },
      () => false,
    );
    expect(started).toEqual([]);
  });
});
