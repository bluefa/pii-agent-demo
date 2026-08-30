// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTested = vi.fn();
const getExcluded = vi.fn();

vi.mock('@/app/lib/api/logical-db', () => ({
  getTestedLogicalDatabases: (...args: unknown[]) => getTested(...args),
  getExcludedLogicalDatabases: (...args: unknown[]) => getExcluded(...args),
}));

import { useLogicalDatabases } from '@/app/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
import type {
  ExcludedLogicalDatabase,
  TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';
import type { TcScope } from '@/app/lib/api/tc-scope';

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
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1', 'latest'));
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
    renderHook(() => useLogicalDatabases(1020, 'srv-1', 'latest'));
    await waitFor(() => expect(getTested).toHaveBeenCalled());
    expect(getTested).toHaveBeenCalledWith(1020, 'srv-1', 'latest', expect.objectContaining({}));
    expect(getExcluded).toHaveBeenCalledWith(1020, 'srv-1', expect.objectContaining({}));
  });

  // ⛔ The PUT is a full replace: saving over a policy we never read would delete
  // exclusions nobody asked to delete. This failure keeps the modal out of the table.
  it('an unreadable EXCLUDED list is an error — the one that blocks saving', async () => {
    getExcluded.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1', 'latest'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    if (result.current.state.status !== 'error') throw new Error('expected error');
    expect(result.current.state.message).toBe('논리 DB 정보를 불러오지 못했습니다.');
  });

  it('…even when the tested list came back fine', async () => {
    getExcluded.mockRejectedValue(new Error('boom'));
    getTested.mockResolvedValue(TESTED);
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1', 'latest'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });

  // The other half of the pair: the run's list is gone, the policy is in hand. That is a
  // different screen, so it must be a different state — `Promise.all` made it one.
  it('an unreadable TESTED list is partial — the policy alone, still editable', async () => {
    getTested.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1', 'latest'));
    await waitFor(() => expect(result.current.state.status).toBe('partial'));
    if (result.current.state.status !== 'partial') throw new Error('expected partial');

    // Both excluded items become rows; nothing else does.
    expect(result.current.state.databases.map((d) => d.id).sort()).toEqual(['legacy', 'stg']);
    expect(result.current.state.databases.every((d) => d.untested)).toBe(true);
    expect(Array.from(result.current.state.initialDraft.excludedIds).sort()).toEqual([
      'legacy',
      'stg',
    ]);
    expect(result.current.state.initialDraft.reasons.stg).toBe('STG');
  });

  // scope 는 fetchKey 의 일부다 — 같은 리소스라도 계열이 바뀌면 다른 목록이라, 다시 읽지
  // 않으면 6단계 모달이 5단계가 읽어 둔 최신 실패분을 그대로 보여준다.
  it('refetches when only the scope changes', async () => {
    const { result, rerender } = renderHook(
      ({ scope }: { scope: TcScope }) => useLogicalDatabases(1020, 'srv-1', scope),
      { initialProps: { scope: 'latest' as TcScope } },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    rerender({ scope: 'latestSuccess' });
    expect(result.current.state.status).toBe('loading');
    await waitFor(() =>
      expect(getTested).toHaveBeenCalledWith(
        1020,
        'srv-1',
        'latestSuccess',
        expect.objectContaining({}),
      ),
    );
  });

  it('retry refetches', async () => {
    const { result } = renderHook(() => useLogicalDatabases(1020, 'srv-1', 'latest'));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const calls = getTested.mock.calls.length;

    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(getTested.mock.calls.length).toBeGreaterThan(calls));
  });
});
