// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { meMock } = vi.hoisted(() => ({ meMock: vi.fn() }));

vi.mock('@/lib/bff/client', () => ({ bff: { users: { me: meMock } } }));
vi.mock('@/app/components/layout/TopNav', () => ({ TopNav: () => null }));

import AdminLayout from '@/app/admin/layout';

const renderGate = async (): Promise<void> => {
  render(await AdminLayout({ children: <p>admin content</p> }));
};

const DENIED = '관리자만 접근할 수 있어요';

describe('AdminLayout role gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ADMIN 이면 children 을 그대로 렌더한다', async () => {
    meMock.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
    await renderGate();
    expect(screen.getByText('admin content')).toBeTruthy();
    expect(screen.queryByText(DENIED)).toBeNull();
  });

  it('role 대소문자/공백은 무시한다', async () => {
    meMock.mockResolvedValue({ id: 'u1', role: ' admin ' });
    await renderGate();
    expect(screen.getByText('admin content')).toBeTruthy();
  });

  // Allowlist, not `!== 'ADMIN'`: an unsettled future role must stay locked out.
  it.each([
    ['USER', { id: 'u1', role: 'USER' }],
    ['SERVICE_MANAGER', { id: 'u1', role: 'SERVICE_MANAGER' }],
    ['role 없음', { id: 'u1' }],
    ['role null', { id: 'u1', role: null }],
  ])('%s 이면 안내만 렌더한다', async (_label, me) => {
    meMock.mockResolvedValue(me);
    await renderGate();
    expect(screen.queryByText('admin content')).toBeNull();
    expect(screen.getByText(DENIED)).toBeTruthy();
  });

  it('/user/me 실패는 차단으로 흡수한다', async () => {
    meMock.mockRejectedValue(new Error('401'));
    await renderGate();
    expect(screen.queryByText('admin content')).toBeNull();
    expect(screen.getByText(DENIED)).toBeTruthy();
  });
});
