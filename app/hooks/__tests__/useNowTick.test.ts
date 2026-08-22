// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNowTick } from '@/app/hooks/useNowTick';

/**
 * 이 훅의 값은 **흐른다**는 것이 전부다. 카드 쪽 테스트는 첫 렌더의 경과만 재므로,
 * 훅이 마운트 시 `Date.now()` 를 한 번 읽고 마는 형태로 퇴행해도 그대로 통과한다 —
 * 화면에서는 숫자가 얼어붙는데도. 그 구간을 여기서 잰다.
 */
describe('useNowTick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-reads the clock every second while active', () => {
    const { result } = renderHook(() => useNowTick(true));
    const first = result.current;
    expect(first).toBe(Date.now());

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current).toBe((first as number) + 3_000);
  });

  /** 꺼진 훅은 타이머도 값도 없다 — 멈춘 시계는 없는 시계보다 나쁘다. */
  it('holds no clock at all when inactive', () => {
    const { result } = renderHook(() => useNowTick(false));
    expect(result.current).toBeNull();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBeNull();
  });

  it('starts flowing when it is switched on, and stops when it is switched off', () => {
    const { result, rerender } = renderHook(({ on }) => useNowTick(on), {
      initialProps: { on: false },
    });
    expect(result.current).toBeNull();

    rerender({ on: true });
    // 켜진 첫 프레임부터 정확하다 — 첫 1초를 비워 두지 않는다.
    expect(result.current).toBe(Date.now());

    rerender({ on: false });
    expect(result.current).toBeNull();
  });

  /** 카드가 몇 장이든 타이머는 하나고, 마지막 구독자가 떠나면 같이 멈춘다. */
  it('runs one timer for every subscriber and clears it with the last unmount', () => {
    const a = renderHook(() => useNowTick(true));
    const b = renderHook(() => useNowTick(true));
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(b.result.current).toBe(a.result.current);

    a.unmount();
    expect(vi.getTimerCount()).toBe(1);
    b.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
