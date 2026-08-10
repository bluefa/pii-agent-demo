// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdcSubmitModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcSubmitModal';

const baseProps = {
  isOpen: true,
  total: 4,
  live: 4,
  excluded: 0,
  phase: 'form' as const,
  pending: false,
  onSubmit: vi.fn(),
  onRetry: vi.fn(),
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
  it('renders the three centered stats with 40px numbers and unified labels', () => {
    render(<IdcSubmitModal {...baseProps} total={4} live={3} excluded={1} />);
    expect(screen.getByText('전체 요청')).toBeTruthy();
    expect(screen.getByText('연동 요청 대상')).toBeTruthy();
    expect(screen.getByText('연동 요청 제외대상')).toBeTruthy();
    const four = screen.getByText('4');
    expect(four.className).toContain('text-[40px]');
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
    render(<IdcSubmitModal {...baseProps} pending />);
    expect((screen.getByRole('button', { name: '요청하기' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '머무르기' }) as HTMLButtonElement).disabled).toBe(true);
  });

  // 재요청 중에도 화면은 실패 프레임이다 — 확인 화면으로 되돌아갔다 오면 깜빡인다.
  it('pending on the failure frame locks its buttons without leaving the frame', () => {
    render(<IdcSubmitModal {...baseProps} phase="error" pending />);
    expect(screen.getByText('승인 요청을 보내지 못했어요')).toBeTruthy();
    expect(screen.queryByText('연동 대상을 승인 요청할까요?')).toBeNull();
    expect((screen.getByRole('button', { name: '다시 요청하기' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '닫기' }) as HTMLButtonElement).disabled).toBe(true);
  });

  // 확인 프레임: 체크와 다음 행선지만. 누를 것이 없어야 한다 — 이 1초는 이미 확정된
  // 전환이고, 그 사이에 누를 수 있는 버튼은 지킬 수 없는 약속이다.
  it('phase=success shows the check frame with no buttons and no counts', () => {
    render(<IdcSubmitModal {...baseProps} phase="success" />);
    expect(screen.getByText('승인 요청을 보냈어요')).toBeTruthy();
    expect(screen.getByText('잠시 후 승인 대기 단계로 이동해요.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('전체 요청')).toBeNull();
    expect(screen.queryByText('연동 대상을 승인 요청할까요?')).toBeNull();
  });

  // 사유는 코드로 고른다 — 매핑에 없는 코드와 코드 부재는 같은 기본 문구로 떨어진다.
  it('phase=error picks the reason from the error code, falling back when it has none', () => {
    const { rerender } = render(<IdcSubmitModal {...baseProps} phase="error" errorCode="CONFLICT" />);
    expect(screen.getByText('승인 요청을 보내지 못했어요')).toBeTruthy();
    expect(screen.getByText('이미 진행 중인 승인 요청이 있어요.')).toBeTruthy();
    expect(screen.queryByText('알 수 없는 오류가 발생했어요.')).toBeNull();

    rerender(<IdcSubmitModal {...baseProps} phase="error" errorCode="NETWORK" />);
    expect(screen.getByText('네트워크 연결을 확인해 주세요.')).toBeTruthy();

    // 매핑에 없는 코드
    rerender(<IdcSubmitModal {...baseProps} phase="error" errorCode="PARSE_ERROR" />);
    expect(screen.getByText('알 수 없는 오류가 발생했어요.')).toBeTruthy();

    rerender(<IdcSubmitModal {...baseProps} phase="error" />);
    expect(screen.getByText('알 수 없는 오류가 발생했어요.')).toBeTruthy();
  });

  it('phase=error offers 다시 요청하기 and 닫기', () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    render(<IdcSubmitModal {...baseProps} phase="error" onRetry={onRetry} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 요청하기' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
