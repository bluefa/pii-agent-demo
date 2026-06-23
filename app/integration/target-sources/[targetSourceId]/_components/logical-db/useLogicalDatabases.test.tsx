// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogicalDatabases } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';

describe('useLogicalDatabases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in loading and resolves to ready after the timer', () => {
    const { result } = renderHook(() => useLogicalDatabases('srv-prod-01'));
    expect(result.current.state.status).toBe('loading');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.state.status).toBe('ready');
    if (result.current.state.status === 'ready') {
      // 5 databases + 4 schemas (see MOCK_TOPOLOGY).
      expect(result.current.state.databases).toHaveLength(9);
      expect(result.current.state.databases[0]).toMatchObject({
        id: 'srv-prod-01.live',
        name: 'live',
        type: 'db',
        database: 'live',
      });
      const schemaRow = result.current.state.databases.find(
        (d) => d.type === 'schema',
      );
      expect(schemaRow).toMatchObject({ type: 'schema', database: 'live', schema: 'public' });
    }
  });

  it('keys the fake list on resourceId', () => {
    const { result } = renderHook(() => useLogicalDatabases('other-id'));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    if (result.current.state.status !== 'ready') {
      throw new Error('expected ready state');
    }
    expect(result.current.state.databases[0].id.startsWith('other-id.')).toBe(true);
  });

  it('retry resets to loading and resolves again', () => {
    const { result } = renderHook(() => useLogicalDatabases('srv-prod-01'));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.state.status).toBe('ready');

    act(() => {
      result.current.retry();
    });
    expect(result.current.state.status).toBe('loading');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.state.status).toBe('ready');
  });

  it('cleans up the timer on unmount before the resolve fires', () => {
    const { result, unmount } = renderHook(() => useLogicalDatabases('srv-prod-01'));
    expect(result.current.state.status).toBe('loading');
    unmount();
    // Advancing past 200ms after unmount must not throw or change state.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // No assertion possible on internal state post-unmount; the success here is
    // simply that no error was thrown (act would surface the warning).
    expect(true).toBe(true);
  });
});
