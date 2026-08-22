// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserChip } from '@/app/components/layout/UserChip';
import type { UserMeResponse } from '@/app/lib/api';

/** Mount with the server-resolved user, then open the account card. */
const openCard = async (me: unknown): Promise<void> => {
  render(<UserChip user={me as UserMeResponse} />);
  fireEvent.click(await screen.findByRole('button'));
};

describe('UserChip 계정 카드의 관리자 항목', () => {
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

// 내 권한 요청은 관리자 항목과 정반대다 — 권한이 없는 사람이 권한을 요청하는 화면이라
// 게이트를 붙이면 대상 사용자만 골라 막는다. role 과 무관하게 늘 있어야 하고, 링크는
// `/admin/**` 밖을 가리켜야 한다(안이면 서버 게이트가 같은 사람들을 되돌려 보낸다).
describe('UserChip 계정 카드의 내 권한 요청 항목', () => {
  it.each([
    ['ADMIN', { id: 'u1', name: '관리자', role: 'ADMIN' }],
    ['USER', { id: 'u1', name: '홍길동', role: 'USER' }],
    ['SERVICE_MANAGER', { id: 'u1', name: '홍길동', role: 'SERVICE_MANAGER' }],
    ['role 없음', { id: 'u1', name: '홍길동' }],
  ])('%s 이면 내 권한 요청 링크가 있다', async (_label, me) => {
    await openCard(me);
    const link = screen.getByRole('link', { name: '내 권한 요청' });
    expect(link.getAttribute('href')).not.toContain('/admin/');
  });
});
