// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScanCompletionTransition } from '@/app/hooks/useScanCompletionTransition';

const SETTLE_MS = 400;
const CONFIRM_MS = 1200;

describe('useScanCompletionTransition', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rests idle until a completion is announced', () => {
    const { result } = renderHook(() => useScanCompletionTransition());
    expect(result.current.stage).toBe('idle');

    // 시간이 흘러도 스스로 시작하지 않는다 — 완료 판정은 useScanPolling 의 몫이다.
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.stage).toBe('idle');
  });

  it('runs settle → confirm → idle', () => {
    const { result } = renderHook(() => useScanCompletionTransition());

    act(() => { result.current.begin(); });
    expect(result.current.stage).toBe('settling');

    // 진행바가 100%에 닿는 구간이 먼저 — 여기서 곧장 결과로 넘어가면 100%를
    // 아무도 보지 못한다.
    act(() => { vi.advanceTimersByTime(SETTLE_MS - 1); });
    expect(result.current.stage).toBe('settling');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.stage).toBe('confirming');

    act(() => { vi.advanceTimersByTime(CONFIRM_MS - 1); });
    expect(result.current.stage).toBe('confirming');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.stage).toBe('idle');
  });

  it('restarts from settle when a rescan completes mid-transition', () => {
    const { result } = renderHook(() => useScanCompletionTransition());

    act(() => { result.current.begin(); });
    act(() => { vi.advanceTimersByTime(SETTLE_MS); });
    expect(result.current.stage).toBe('confirming');

    act(() => { result.current.begin(); });
    expect(result.current.stage).toBe('settling');

    // 이전 dwell 타이머가 살아 있었다면 여기서 idle 로 떨어졌을 것이다.
    act(() => { vi.advanceTimersByTime(CONFIRM_MS); });
    expect(result.current.stage).toBe('confirming');
    act(() => { vi.advanceTimersByTime(SETTLE_MS); });
    expect(result.current.stage).toBe('idle');
  });

  it('drops its timers on unmount', () => {
    const { result, unmount } = renderHook(() => useScanCompletionTransition());
    act(() => { result.current.begin(); });

    unmount();
    // 언마운트 뒤 타이머가 남아 있으면 여기서 setState 경고가 난다.
    expect(() => { vi.advanceTimersByTime(SETTLE_MS + CONFIRM_MS); }).not.toThrow();
  });
});
