import { describe, expect, it } from 'vitest';
import type { PipelineStatus, PipelineSummary } from '@/lib/pipeline/types';
import {
  type ServiceItem,
  filterServices,
  latestCellState,
  runWithConcurrency,
  serviceItemsFrom,
} from '@/app/integration/admin/pipelines/_services/logic';

const svc = (code: string, name: string): ServiceItem => ({
  service_code: code,
  service_name: name,
});

const summary = (status: PipelineStatus): PipelineSummary => ({
  pipeline_id: 1,
  type: 'INSTALL',
  target_source_id: '101',
  cloud_provider: 'AWS',
  recipe_definition: 'AWS_INSTALL_V1',
  status,
  done_task_count: 0,
  total_task_count: 3,
  created_at: '2026-07-01T00:00:00Z',
  last_activity_at: '2026-07-01T00:00:00Z',
});

describe('filterServices', () => {
  const items = [svc('SVC001', 'svc-alpha'), svc('SVC002', 'svc-beta'), svc('OTHER', 'gamma')];

  it('passes everything through for an empty/whitespace query', () => {
    expect(filterServices(items, '')).toHaveLength(3);
    expect(filterServices(items, '   ')).toHaveLength(3);
  });

  it('matches code+name case-insensitively', () => {
    expect(filterServices(items, 'alpha').map((s) => s.service_code)).toEqual(['SVC001']);
    expect(filterServices(items, 'svc00').map((s) => s.service_code)).toEqual(['SVC001', 'SVC002']);
    expect(filterServices(items, 'GAMMA').map((s) => s.service_code)).toEqual(['OTHER']);
  });

  it('tolerates missing code/name fields', () => {
    expect(filterServices([{ service_name: 'only-name' }], 'only')).toHaveLength(1);
    expect(filterServices([{}], 'x')).toHaveLength(0);
  });
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
    const page = { content: [svc('A', 'a')] } as never;
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
});
