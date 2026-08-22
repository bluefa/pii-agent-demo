'use client';

import { useSyncExternalStore } from 'react';

/**
 * 1초마다 다시 읽히는 현재 시각(ms epoch). `active` 가 false 면 타이머도 값도 없다.
 *
 * 끝을 모르는 대기에서 화면이 살아 있다고 말할 수 있는 것은 스스로 변하는 숫자뿐이다 —
 * Step 5 연결 테스트는 폴이 4초라, 이 훅이 없으면 폴 사이 4초 동안 카드에서 변하는
 * 픽셀이 15px 글리프 안의 마디 하나뿐이다.
 *
 * 흐르는 시계는 React 밖의 값이라 외부 스토어로 둔다. state 로 들고 있으면 켜지는
 * 순간의 값을 이펙트에서 써 넣어야 하고(첫 1초를 비워 둘 수는 없다) 그게 곧 연쇄
 * 렌더이며, 렌더에서 직접 `Date.now()` 를 읽으면 렌더가 순수하지 않다 — 컴파일러
 * 규칙이 둘 다 막는다. 구독은 그 둘을 다 피하면서 켜진 첫 프레임부터 정확하다.
 */

/** 마지막으로 흘린 시각. 구독자가 없으면 갱신되지 않는다. */
let currentMs = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const flow = (): void => {
  currentMs = Date.now();
  for (const listener of listeners) listener();
};

/** 카드가 몇 장이든 타이머는 하나다 — 마지막 구독자가 떠나면 같이 멈춘다. */
const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  if (timer === null) {
    currentMs = Date.now();
    timer = setInterval(flow, 1_000);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
};

const NOOP = (): void => {};
/** 꺼진 훅은 구독하지 않는다 — 이 자리가 `active` 게이트다. */
const subscribeNever = (): (() => void) => NOOP;

const getSnapshot = (): number => currentMs;
/** 서버엔 흐르는 시계가 없다. 0 은 "아직 시각이 없음"이고 훅이 null 로 바꾼다. */
const getStillSnapshot = (): number => 0;

export const useNowTick = (active: boolean): number | null => {
  const now = useSyncExternalStore(
    active ? subscribe : subscribeNever,
    active ? getSnapshot : getStillSnapshot,
    getStillSnapshot,
  );
  // 꺼진 뒤 남은 마지막 값을 돌려주지 않는다 — 멈춘 시계는 없는 시계보다 나쁘다.
  return now === 0 ? null : now;
};

export default useNowTick;
