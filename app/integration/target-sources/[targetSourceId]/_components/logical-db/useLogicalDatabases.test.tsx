// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTested = vi.fn();
const getExcluded = vi.fn();

vi.mock('@/app/lib/api/logical-db', () => ({
  getTestedLogicalDatabases: (...args: unknown[]) => getTested(...args),
  getExcludedLogicalDatabases: (...args: unknown[]) => getExcluded(...args),
}));

import { useLogicalDatabases } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
import type {
  ExcludedLogicalDatabase,
  TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';

const TESTED: TestedLogicalDatabase[] = [
  { databaseName: 'live', type: 'DATABASE' },
  { databaseName: 'live', schemaName: 'public', type: 'SCHEMA' },
  { databaseName: 'stg', type: 'DATABASE' },
];

const EXCLUDED: ExcludedLogicalDatabase[] = [
  { databaseName: 'stg', skipReason: 'STG', type: 'DATABASE' },
  { databaseName: 'legacy', skipReason: 'TEMP', type: 'DATABASE' }, // excluded-only
];

describe('useLogicalDatabases', () => {
  beforeEach(() => {
    getTested.mockReset();
    getExcluded.mockReset();
    getTested.mockResolvedValue(TESTED);
    getExcluded.mockResolvedValue(EXCLUDED);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts loading then resolves with adapted rows + seeded draft', async () => {
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1'));
    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status !== 'ready') throw new Error('expected ready');

    // 3 tested rows + 1 excluded-only ('legacy') = 4 left-panel rows.
    expect(result.current.state.databases).toHaveLength(4);
    const stg = result.current.state.databases.find((d) => d.id === 'stg');
    expect(stg?.existingDenyReason).toBe('STG'); // greyed-out via existing skip
    expect(result.current.state.databases.some((d) => d.id === 'legacy')).toBe(true);

    // Seeded draft mirrors the excluded set + reasons.
    expect(Array.from(result.current.state.initialDraft.excludedIds).sort()).toEqual([
      'legacy',
      'stg',
    ]);
    expect(result.current.state.initialDraft.reasons.stg).toBe('STG');
    expect(result.current.state.initialDraft.reasons.legacy).toBe('TEMP');
  });

  it('fetches both lists by resourceId', async () => {
    renderHook(() => useLogicalDatabases(1020, 'srv-1'));
    await waitFor(() => expect(getTested).toHaveBeenCalled());
    expect(getTested).toHaveBeenCalledWith(1020, 'srv-1', expect.objectContaining({}));
    expect(getExcluded).toHaveBeenCalledWith(1020, 'srv-1', expect.objectContaining({}));
  });

  it('surfaces an error state when a fetch rejects', async () => {
    getExcluded.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    if (result.current.state.status !== 'error') throw new Error('expected error');
    expect(result.current.state.message).toBe('논리 DB 정보를 불러오지 못했습니다.');
  });

  it('retry refetches', async () => {
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1'));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const calls = getTested.mock.calls.length;

    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(getTested.mock.calls.length).toBeGreaterThan(calls));
  });
});
