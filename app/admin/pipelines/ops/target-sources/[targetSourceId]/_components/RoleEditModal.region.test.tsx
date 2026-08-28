// @vitest-environment jsdom
/**
 * Role 모달의 권역 칩 — 계정 옆에 붙는 작은 표. 중국일 때만 선다 (오너 2026-08-28 "Admin
 * 페이지에서 중국으로 표기하라는거야. Global로 표현되고 있던 부분이 있으면 이것도 그냥
 * 없애. 따로 보여주지마").
 *
 * 여기서 붙드는 것은 칩 하나가 아니라 그 앞의 구분점까지다. 점을 칩 바깥에 두면 무표기
 * 대상에서 계정 번호 뒤에 점 하나가 매달린 채 남고, 칩만 검사하는 테스트는 그걸 못 본다.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/pipelines/ops/target-sources/1018',
}));

import { RoleEditModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RoleEditModal';

const ACCOUNT = '918273645500';

const renderModal = (regionLabel: string | null, isChinaRegion: boolean): void => {
  render(
    <RoleEditModal
      open
      onClose={vi.fn()}
      targetSourceId={1018}
      kind="scan"
      accountId={ACCOUNT}
      isChinaRegion={isChinaRegion}
      regionLabel={regionLabel}
      onSaved={vi.fn()}
    />,
  );
};

describe('RoleEditModal — 권역 칩', () => {
  it('중국이면 「중국」 칩이 계정 옆에 선다', () => {
    renderModal('중국', true);
    expect(screen.getByText('중국')).toBeTruthy();
    expect(screen.getByText(ACCOUNT)).toBeTruthy();
    expect(screen.getByText('·')).toBeTruthy();
  });

  it('중국이 아니면 칩도 구분점도 없다', () => {
    renderModal(null, false);
    expect(screen.queryByText('중국')).toBeNull();
    expect(screen.queryByText('Global')).toBeNull();
    // 계정은 그대로 있고, 그 뒤에 매달린 점이 없다.
    expect(screen.getByText(ACCOUNT)).toBeTruthy();
    expect(screen.queryByText('·')).toBeNull();
  });
});
