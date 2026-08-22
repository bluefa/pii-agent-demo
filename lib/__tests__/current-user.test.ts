import { beforeEach, describe, expect, it, vi } from 'vitest';

const { meMock } = vi.hoisted(() => ({ meMock: vi.fn() }));
vi.mock('@/lib/bff/client', () => ({ bff: { users: { me: meMock } } }));

import { getMeOrNull } from '@/lib/bff/current-user';

// 칩은 실패를 화면에 올리지 않는다 — 인증은 앱 앞단(IAP/SSO)의 몫이라 /user/me 가
// 답하지 않으면 그냥 숨는다. 이게 throw 로 새면 TopNav 를 든 레이아웃 전체가 깨진다.
describe('getMeOrNull', () => {
  beforeEach(() => vi.clearAllMocks());

  it('/user/me 가 실패하면 null 이다', async () => {
    meMock.mockRejectedValue(new Error('BFF down'));
    await expect(getMeOrNull()).resolves.toBeNull();
  });

  it('성공하면 응답을 그대로 넘긴다', async () => {
    meMock.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
    await expect(getMeOrNull()).resolves.toEqual({ id: 'u1', role: 'ADMIN' });
  });
});
