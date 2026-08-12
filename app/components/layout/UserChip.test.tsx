// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentUserMock } = vi.hoisted(() => ({ getCurrentUserMock: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ getCurrentUser: getCurrentUserMock }));

import { UserChip } from '@/app/components/layout/UserChip';

/** Mount, resolve /user/me, then open the account card. */
const openCard = async (me: unknown): Promise<void> => {
  getCurrentUserMock.mockResolvedValue(me);
  render(<UserChip />);
  fireEvent.click(await screen.findByRole('button'));
};

describe('UserChip 계정 카드의 관리자 항목', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ADMIN 이면 관리자 링크가 있다', async () => {
    await openCard({ id: 'u1', name: '관리자', role: 'ADMIN' });
    const link = screen.getByRole('link', { name: '관리자' });
    expect(link.getAttribute('href')).toContain('/admin/pipelines');
  });

  // 노출은 서버 게이트와 같은 isAdminRole 을 쓴다. 여기가 느슨해지면 눌러도
  // 차단되는 링크를 비관리자에게 주게 된다.
  it.each([
    ['USER', { id: 'u1', name: '홍길동', role: 'USER' }],
    ['SERVICE_MANAGER', { id: 'u1', name: '홍길동', role: 'SERVICE_MANAGER' }],
    ['role 없음', { id: 'u1', name: '홍길동' }],
    ['role 이 문자열이 아님', { id: 'u1', name: '홍길동', role: 123 }],
  ])('%s 이면 관리자 링크가 없다', async (_label, me) => {
    await openCard(me);
    expect(screen.getByText('홍길동')).toBeTruthy(); // 카드 자체는 열렸다
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull();
  });

  it('대소문자/공백은 게이트와 같게 무시한다', async () => {
    await openCard({ id: 'u1', name: '관리자', role: ' admin ' });
    expect(screen.getByRole('link', { name: '관리자' })).toBeTruthy();
  });
});
