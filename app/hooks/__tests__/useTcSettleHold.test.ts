// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTcSettleHold } from '@/app/hooks/useTcSettleHold';
import type { TestConnectionVersionResult } from '@/app/lib/api';

const job = (
  version: number,
  status: TestConnectionVersionResult['connection_status'],
): TestConnectionVersionResult =>
  ({
    test_connection_version: version,
    connection_status: status,
    requested_at: '2026-08-09T00:00:00Z',
    completed_at: null,
    test_connection_agent_results: [],
  }) as unknown as TestConnectionVersionResult;

describe('useTcSettleHold', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adopts a run that was already settled at first observation — no choreography', () => {
    const { result, rerender } = renderHook(({ j }) => useTcSettleHold(j), {
      initialProps: { j: null as TestConnectionVersionResult | null },
    });
    expect(result.current.holding).toBe(false);

    rerender({ j: job(3, 'SUCCESS') });
    expect(result.current.holding).toBe(false);
    expect(result.current.settledLive).toBe(false);
  });

  it('holds 400ms on a live settle edge, then reveals', () => {
    const { result, rerender } = renderHook(({ j }) => useTcSettleHold(j), {
      initialProps: { j: job(4, 'RUNNING') as TestConnectionVersionResult | null },
    });

    rerender({ j: job(4, 'SUCCESS') });
    expect(result.current.holding).toBe(true);
    expect(result.current.settledLive).toBe(false);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.holding).toBe(false);
    expect(result.current.settledLive).toBe(true);
  });

  it('fires on FAIL settles too, and on a version skip (in-progress v4 → settled v5)', () => {
    const { result, rerender } = renderHook(({ j }) => useTcSettleHold(j), {
      initialProps: { j: job(4, 'PENDING') as TestConnectionVersionResult | null },
    });
    rerender({ j: job(5, 'FAIL') });
    expect(result.current.holding).toBe(true);
  });

  it('a new run starting resets the reveal (check draw never replays on a stale run)', () => {
    const { result, rerender } = renderHook(({ j }) => useTcSettleHold(j), {
      initialProps: { j: job(4, 'RUNNING') as TestConnectionVersionResult | null },
    });
    rerender({ j: job(4, 'SUCCESS') });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.settledLive).toBe(true);

    rerender({ j: job(5, 'PENDING') });
    expect(result.current.holding).toBe(false);
    expect(result.current.settledLive).toBe(false);
  });
});
