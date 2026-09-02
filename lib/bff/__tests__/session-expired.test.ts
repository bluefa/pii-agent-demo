import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BffError } from '@/lib/bff/errors';
import { passRoutes } from '@/lib/routes';

/**
 * A 401 caught on the server has to leave for the login (ADR-008 §91), and it has
 * to come back to the page the reader was on. The path is not in the module's
 * hands — `proxy.ts` puts it on the request — so both halves are pinned here:
 * the header is read, and its absence still produces a page that exists.
 */
const inbound = vi.hoisted(() => ({ current: new Headers() }));

// Throws, like the real one: `redirect()` unwinds the render, so anything the
// caller would have painted after it never runs.
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);

vi.mock('next/headers', () => ({ headers: async () => inbound.current }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

import { redirectIfSessionExpired } from '@/lib/bff/session-expired';

const DASHBOARD = `/sso/login?returnTo=${encodeURIComponent(`/pass${passRoutes.pipelines.dashboard}`)}`;

describe('redirectIfSessionExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inbound.current = new Headers();
  });

  it('401 은 요청 경로를 그대로 물고 로그인으로 나간다', async () => {
    const path = '/pass/admin/pipelines/ops/alerts?kind=NEED_INSTALL&page=2';
    inbound.current = new Headers({ 'x-pathname': path });

    await expect(redirectIfSessionExpired(new BffError(401, 'UNAUTHORIZED', 'expired'))).rejects.toThrow(
      `NEXT_REDIRECT:/sso/login?returnTo=${encodeURIComponent(path)}`,
    );
  });

  // 헤더가 없으면 프록시가 안 돈 요청이다. 그래도 착지할 곳은 실재해야 한다 —
  // `/pass/admin` 에는 페이지가 없어서 재로그인 직후 404 로 떨어진다.
  it('헤더가 없으면 콘솔 대시보드로 물러선다', async () => {
    await expect(redirectIfSessionExpired(new BffError(401, 'UNAUTHORIZED', 'expired'))).rejects.toThrow(
      `NEXT_REDIRECT:${DASHBOARD}`,
    );
    expect(passRoutes.pipelines.dashboard).toBe('/admin/pipelines');
  });

  // 401 만 만료다. 나머지는 부르는 쪽이 자기 문장(「조회 실패」·권한 안내)을 그대로
  // 말해야 하므로, 여기서는 조용히 돌아온다.
  it.each([
    ['403 (권한 판정)', new BffError(403, 'FORBIDDEN', 'nope')],
    ['500 (BFF 장애)', new BffError(500, 'UPSTREAM', 'boom')],
    ['BffError 가 아닌 실패', new Error('401')],
    ['에러가 아닌 값', 'boom'],
  ])('%s 는 이동하지 않는다', async (_label, err) => {
    inbound.current = new Headers({ 'x-pathname': '/pass/admin/pipelines' });
    await expect(redirectIfSessionExpired(err)).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
