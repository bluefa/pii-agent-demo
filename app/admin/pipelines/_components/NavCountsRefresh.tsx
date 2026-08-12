'use client';

import { createContext, useContext } from 'react';

/**
 * 사이드바 뱃지 카운트를 다시 읽으라는 신호.
 *
 * 뱃지(`app/admin/pipelines/layout.tsx`)와 운영 알림 카드는 **같은**
 * `dashboard-summary` 를 읽는다. 인터벌이 있던 시절엔 둘이 어긋나도 다음 틱이
 * 덮었지만, 인터벌을 걷어낸 지금은 화면 안 새로고침이 카드만 갱신하고 바로 옆
 * 뱃지는 낡은 숫자를 계속 단다 — 한 화면이 서로 다른 두 숫자를 말한다.
 *
 * 그래서 자체 새로고침을 가진 화면은 그걸 누를 때 이 신호도 함께 보낸다.
 * 기본값은 no-op 이라 provider 밖(다른 admin 화면)에서도 안전하다.
 */
const NavCountsRefreshContext = createContext<() => void>(() => undefined);

export const NavCountsRefreshProvider = NavCountsRefreshContext.Provider;

export const useNavCountsRefresh = (): (() => void) => useContext(NavCountsRefreshContext);
