// @vitest-environment jsdom
/**
 * 실행 기록 모달의 대기 프레임 — 형제 TcHistoryModal 과 같은 두 가지 어긋남이다:
 * 220px 빈 상자로 열렸다가 표가 통째로 들어서는 것, 그리고 페이지를 넘길 때마다
 * 페이저가 표와 함께 사라졌다 다시 서는 것. 열은 다섯이라 자국도 다섯 칸이다.
 */
import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { TcExecutionPage } from '@/app/lib/api/task-queue-tc';

const h = vi.hoisted(() => ({ pending: [] as Array<(page: TcExecutionPage) => void> }));

vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionExecutionHistory: vi.fn(
    () => new Promise<TcExecutionPage>((resolve) => h.pending.push(resolve)),
  ),
}));

import { TcRunHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcRunHistoryModal';

const PAGE: TcExecutionPage = {
  totalElements: 8,
  totalPages: 2,
  content: [
    {
      version: 3,
      status: 'SUCCESS',
      requestedAt: '2026-08-01T01:00:00Z',
      completedAt: '2026-08-01T01:02:00Z',
    },
    {
      version: 2,
      status: 'FAIL',
      requestedAt: '2026-07-30T01:00:00Z',
      completedAt: '2026-07-30T01:01:00Z',
    },
  ],
};

const settle = async (): Promise<void> => {
  await act(async () => {
    h.pending.shift()?.(PAGE);
  });
};

describe('TcRunHistoryModal — 대기 프레임', () => {
  beforeEach(() => {
    h.pending.length = 0;
  });

  it('실행 기록을 기다리는 동안 정착본 표의 자국을 그린다', async () => {
    const { container } = render(<TcRunHistoryModal targetSourceId={2103} onClose={() => {}} />);

    // 다섯 열 이름은 이 모달이 이미 아는 고정 문자열이라 실물로 선다.
    for (const label of ['회차', '요청 시각', '완료 시각', '소요', '결과']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(25);
    expect(container.querySelector('[aria-busy]')?.textContent).toContain('불러오는 중');

    await settle();
    expect(screen.getByText('회차')).toBeTruthy();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  it('페이지를 넘기는 동안 페이저는 그대로 서 있다', async () => {
    render(<TcRunHistoryModal targetSourceId={2103} onClose={() => {}} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /다음/ }));

    expect(screen.getByRole('button', { name: /다음/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /이전/ })).toBeTruthy();
    await settle();
    expect(screen.getByRole('button', { name: /다음/ })).toBeTruthy();
  });
});
