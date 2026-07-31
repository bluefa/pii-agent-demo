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

  it('renders the three centered stats with 36px numbers', () => {
    render(<IdcSubmitModal {...baseProps} total={4} live={3} excluded={1} />);
    expect(screen.getByText('전체 리소스')).toBeTruthy();
    expect(screen.getByText('연동 대상')).toBeTruthy();
    expect(screen.getByText('미연동 대상')).toBeTruthy();
    const four = screen.getByText('4');
    expect(four.className).toContain('text-[36px]');
    expect(four.parentElement?.className ?? four.className).toBeTruthy();
    // Tiles are center-aligned.
    expect(four.closest('div.text-center')).toBeTruthy();
  });

  it('disables both buttons while submitting', () => {
    render(<IdcSubmitModal {...baseProps} submitting />);
    expect((screen.getByRole('button', { name: '요청하기' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '머무르기' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
