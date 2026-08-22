// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { meMock } = vi.hoisted(() => ({ meMock: vi.fn() }));

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
  beforeEach(() => vi.clearAllMocks());

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
    ['401 (SSO 만료)', new Error('401')],
    ['5xx (BFF 장애)', new Error('500')],
  ])('%s 는 차단하되 장애로 안내한다', async (_label, err) => {
    meMock.mockRejectedValue(err);
    await renderGate();
    expect(screen.queryByText('admin content')).toBeNull();
    expect(screen.getByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByText(DENIED)).toBeNull();
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
