// @vitest-environment jsdom
/**
 * 「승인 요청 내역」 카드의 대기 프레임.
 *
 * 이 카드의 본문 슬롯은 고정 높이(`opsStyles.pagedCardBody`)라 조회가 도는 동안에도
 * 자리는 그대로 있었다 — 그래서 비어 있는 것이 눈에 띄지 않고 오래 갔다. 카드 하나가
 * 다 그려진 화면 안에서 그 한 칸만 흰 여백이면, 읽는 쪽은 「내역이 없다」로 읽는다.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const getApprovalHistory = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getApprovalHistory: (...args: unknown[]) => getApprovalHistory(...args),
}));

import { ApprovalHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ApprovalHistoryCard';

describe('ApprovalHistoryCard — 대기 프레임', () => {
  it('내역을 기다리는 동안 표의 자국을 그린다', () => {
    // 끝나지 않는 조회 — 로딩 프레임을 붙잡아 둔다.
    getApprovalHistory.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ApprovalHistoryCard targetSourceId={1642} isIdc={false} />);

    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    expect(busy?.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    // 머리글은 서버 없이 아는 고정 문자열이라 기다리는 동안에도 실물로 선다.
    expect(screen.getByText('요청 일시')).toBeTruthy();
    // 비어 있는 것과 아직 안 온 것은 다르다.
    expect(screen.queryByText('승인 요청 내역이 없습니다.')).toBeNull();
  });
});
