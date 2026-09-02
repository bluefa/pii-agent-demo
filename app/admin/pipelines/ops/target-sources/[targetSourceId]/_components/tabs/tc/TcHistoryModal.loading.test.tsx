// @vitest-environment jsdom
/**
 * 승인·반려 이력 모달의 대기 프레임.
 *
 * 두 가지가 화면에서 조용히 어긋난다: (1) 모달이 제목·설명 아래 220px 의 빈 상자로
 * 열려서, 표가 도착하는 순간 그 자리가 통째로 뒤집힌다. (2) 페이저가 `loading` 에
 * 걸려 있어서 **페이지를 넘길 때마다** 표와 함께 사라졌다가 다시 선다 — 방금 누른
 * 버튼이 손 밑에서 없어진다.
 */
import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { TcHistoryPage } from '@/app/lib/api/task-queue-tc';

const h = vi.hoisted(() => ({ pending: [] as Array<(page: TcHistoryPage) => void> }));

vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionHistory: vi.fn(
    () => new Promise<TcHistoryPage>((resolve) => h.pending.push(resolve)),
  ),
}));

import { TcHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryModal';

const PAGE: TcHistoryPage = {
  totalPages: 3,
  content: [
    { status: 'TEST_CONNECTION_COMPLETED', reason: null, createdAt: '2026-08-01T01:00:00Z' },
    { status: 'TEST_CONNECTION_REJECTED', reason: '자격증명 오류', createdAt: '2026-07-30T01:00:00Z' },
  ],
};

const settle = async (): Promise<void> => {
  await act(async () => {
    h.pending.shift()?.(PAGE);
  });
};

describe('TcHistoryModal — 대기 프레임', () => {
  // 큐는 테스트마다 비운다 — 앞 테스트가 남긴 resolver 를 집으면 이미 끝난 약속을 흔든다.
  beforeEach(() => {
    h.pending.length = 0;
  });

  it('이력을 기다리는 동안 정착본 표의 자국을 그린다', async () => {
    const { container } = render(<TcHistoryModal targetSourceId={2103} onClose={() => {}} />);

    // 열 이름은 이 모달이 이미 아는 고정 문자열이라 실물로 선다.
    expect(screen.getByText('일시')).toBeTruthy();
    expect(screen.getByText('상태')).toBeTruthy();
    expect(screen.getByText('사유')).toBeTruthy();
    // 기다리는 건 값뿐 — 페이지 크기만큼의 행이 바로 서 있다.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(15);
    // 자국만 그리고 기다린다고 말하지 않으면 낭독은 빈 모달을 읽는다.
    expect(container.querySelector('[aria-busy]')?.textContent).toContain('불러오는 중');

    await settle();
    // 정착본은 같은 머리를 쓴다 — 스켈레톤과 표가 머리를 따로 적지 않는다.
    expect(screen.getByText('일시')).toBeTruthy();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  it('페이지를 넘기는 동안 페이저는 그대로 서 있다', async () => {
    render(<TcHistoryModal targetSourceId={2103} onClose={() => {}} />);
    await settle();

    const next = screen.getByRole('button', { name: /다음/ });
    fireEvent.click(next);

    // 표는 다시 자국으로 돌아가지만, 페이저의 모양은 행이 아니라 페이지 수가 정한다.
    expect(screen.getByRole('button', { name: /다음/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /이전/ })).toBeTruthy();
    await settle();
    expect(screen.getByRole('button', { name: /다음/ })).toBeTruthy();
  });
});
