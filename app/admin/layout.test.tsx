// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff/errors';
import { passRoutes } from '@/lib/routes';

const { meMock, redirectMock, inbound } = vi.hoisted(() => ({
  meMock: vi.fn(),
  // Throws, like the real one: `redirect()` unwinds the render, so a session that
  // expired never reaches a notice.
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  // The request headers proxy.ts hands the server — where the returned-to path
  // comes from.
  inbound: { current: new Headers() },
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/headers', () => ({ headers: async () => inbound.current }));
vi.mock('@/lib/bff/current-user', () => ({ getMe: meMock }));
// Rendered, not stubbed to null: TopNav is the denied user's only way off this
// page (the notice carries no link of its own), so its presence is an assertion.
vi.mock('@/app/components/layout/TopNav', () => ({ TopNav: () => <nav>topnav</nav> }));

import AdminLayout from '@/app/admin/layout';

const renderGate = async (): Promise<void> => {
  render(await AdminLayout({ children: <p>admin content</p> }));
};

const DENIED = '관리자만 접근할 수 있어요';
const UNAVAILABLE = '권한을 확인하지 못했어요';

describe('AdminLayout role gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inbound.current = new Headers();
  });

  it('ADMIN 이면 children 을 그대로 렌더한다', async () => {
    meMock.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
    await renderGate();
    expect(screen.getByText('admin content')).toBeTruthy();
    expect(screen.queryByText(DENIED)).toBeNull();
    // Pins TopNav placement from this side too — the deny-branch test alone
    // would stay green if TopNav moved inside the deny branch.
    expect(screen.getByText('topnav')).toBeTruthy();
  });

  it('role 대소문자/공백은 무시한다', async () => {
    meMock.mockResolvedValue({ id: 'u1', role: ' admin ' });
    await renderGate();
    expect(screen.getByText('admin content')).toBeTruthy();
  });

  // Allowlist, not `!== 'ADMIN'`: an unsettled future role must stay locked out.
  // The malformed rows matter because `users.me()` is an unparsed passthrough —
  // they must deny, not throw.
  it.each([
    ['USER', { id: 'u1', role: 'USER' }],
    ['SERVICE_MANAGER', { id: 'u1', role: 'SERVICE_MANAGER' }],
    ['role 없음', { id: 'u1' }],
    ['role null', { id: 'u1', role: null }],
    ['role 공백', { id: 'u1', role: '   ' }],
    ['role 이 문자열이 아님', { id: 'u1', role: 123 }],
    ['role 이 객체', { id: 'u1', role: { name: 'ADMIN' } }],
    ['응답이 null', null],
  ])('%s 이면 안내만 렌더한다', async (_label, me) => {
    meMock.mockResolvedValue(me);
    await renderGate();
    expect(screen.queryByText('admin content')).toBeNull();
    expect(screen.getByText(DENIED)).toBeTruthy();
  });

  // 조회 실패는 닫되, 권한 판정으로 말하지 않는다. 장애 중인 진짜 관리자에게
  // "당신은 관리자가 아니다"라고 하면 이미 가진 권한을 요청하러 가게 된다.
  it.each([
    ['상태를 모르는 실패', new Error('401')],
    ['5xx (BFF 장애)', new BffError(500, 'UPSTREAM', 'boom')],
  ])('%s 는 차단하되 장애로 안내한다', async (_label, err) => {
    meMock.mockRejectedValue(err);
    await renderGate();
    expect(screen.queryByText('admin content')).toBeNull();
    expect(screen.getByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByText(DENIED)).toBeNull();
    // 장애는 로그인으로 보내지 않는다 — 다시 로그인해도 BFF 는 여전히 죽어 있다.
    expect(redirectMock).not.toHaveBeenCalled();
  });

  /**
   * 401 은 장애도 판정도 아니라 만료다(ADR-008 §91). 여기서 "권한을 확인하지 못했어요" 를
   * 띄우면 세션만 상한 관리자가 장애 제보를 하러 간다 — 필요한 건 재로그인이다.
   *
   * 돌아갈 자리는 보던 그 페이지다. 레이아웃은 요청 경로를 모르지만 proxy.ts 가
   * 헤더로 실어 준다 — 그 값이 곧 returnTo 라, 깊은 링크가 재로그인에서 살아남는다.
   */
  it('401 은 안내 대신 보던 페이지로 되돌아오는 SSO 로그인을 연다', async () => {
    const path = '/pass/admin/pipelines/ops/alerts?kind=NEED_INSTALL';
    inbound.current = new Headers({ 'x-pathname': path });
    meMock.mockRejectedValue(new BffError(401, 'UNAUTHORIZED', 'token expired'));
    await expect(renderGate()).rejects.toThrow(
      `NEXT_REDIRECT:/sso/login?returnTo=${encodeURIComponent(path)}`,
    );
  });

  // 헤더가 없는 요청(프록시 매처 밖)에서도 착지할 곳은 있어야 한다. `/pass/admin` 이
  // 아닌 건 그 자리에 페이지가 없어서다: 재로그인 뒤 404 로 떨어진다.
  it('경로 헤더가 없으면 콘솔 대시보드로 물러선다', async () => {
    meMock.mockRejectedValue(new BffError(401, 'UNAUTHORIZED', 'token expired'));
    await expect(renderGate()).rejects.toThrow(
      `NEXT_REDIRECT:/sso/login?returnTo=${encodeURIComponent(`/pass${passRoutes.pipelines.dashboard}`)}`,
    );
  });

  // 그 대시보드가 실재하는 페이지인지까지 고정한다 — 상수만 따라가면 둘이 같이 틀려도
  // 초록이다. 이 문자열이 곧 재로그인 뒤 도착지다.
  it('돌아갈 대시보드는 실제로 존재하는 경로다', () => {
    expect(passRoutes.pipelines.dashboard).toBe('/admin/pipelines');
  });

  // 차단 화면에는 자체 링크가 없다. TopNav 가 유일한 탈출구라서, 차단 분기
  // 안으로 옮기거나 지우면 막다른 화면이 된다.
  it('차단된 사용자에게도 TopNav 는 남는다', async () => {
    meMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    await renderGate();
    expect(screen.getByText('topnav')).toBeTruthy();
  });

  // 게이트를 요청마다 돌게 하는 유일한 선언. 지워도 나머지 테스트는 전부
  // 통과하므로 여기서 직접 고정한다.
  it('force-dynamic 을 선언한다', async () => {
    const mod = await import('@/app/admin/layout');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
