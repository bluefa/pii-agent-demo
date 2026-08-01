// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdcSubmitModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcSubmitModal';

const baseProps = {
  isOpen: true,
  total: 4,
  live: 4,
  excluded: 0,
  submitting: false,
  onSubmit: vi.fn(),
  onClose: vi.fn(),
};

describe('IdcSubmitModal', () => {
  // Unified step-flow confirm grammar: question title, 요청하기/머무르기 on the
  // compact scale, no close-X (ConfirmStepModal renders none).
  it('renders on the unified confirm grammar with 요청하기', () => {
    render(<IdcSubmitModal {...baseProps} />);
    expect(screen.getByText('연동 대상을 승인 요청할까요?')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: '요청하기' });
    expect(confirm.className).toContain('h-10');
    expect(screen.getByRole('button', { name: '머무르기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '닫기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '제출하기' })).toBeNull();
  });

  // Tile labels share the step-2 stats vocabulary (WaitingApprovalStats) verbatim.
  it('renders the three centered stats with 36px numbers and unified labels', () => {
    render(<IdcSubmitModal {...baseProps} total={4} live={3} excluded={1} />);
    expect(screen.getByText('전체 요청')).toBeTruthy();
    expect(screen.getByText('연동 요청 대상')).toBeTruthy();
    expect(screen.getByText('연동 요청 제외대상')).toBeTruthy();
    const four = screen.getByText('4');
    expect(four.className).toContain('text-[36px]');
    expect(four.parentElement?.className ?? four.className).toBeTruthy();
    // Tiles are center-aligned.
    expect(four.closest('div.text-center')).toBeTruthy();
  });

  // The description states the request as M-of-N with ONE blue emphasis on the
  // action phrase — color only, never weight. The cancel-path sentence stays plain.
  it('emphasizes only the M-of-N action phrase in color-only blue', () => {
    render(<IdcSubmitModal {...baseProps} total={4} live={3} excluded={1} />);
    expect(screen.getByText(/전체 4건 중/)).toBeTruthy();
    const action = screen.getByText('3건을 연동 대상으로 요청해요');
    expect(action.className).toContain('text-[#0064FF]');
    expect(action.className).not.toMatch(/font-/);
    // No dedicated emphasis node for the cancel path — it lives in the plain text.
    expect(screen.queryByText('취소 후 다시 요청')).toBeNull();
    expect(screen.getByText(/취소 후 다시 요청해야 해요/)).toBeTruthy();
  });

  it('disables both buttons while submitting', () => {
    render(<IdcSubmitModal {...baseProps} submitting />);
    expect((screen.getByRole('button', { name: '요청하기' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '머무르기' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
