// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { modalStyles } from '@/lib/theme';

describe('ConfirmStepModal', () => {
  const baseProps = {
    title: '취소할까요?',
    description: '되돌아갑니다',
    confirmLabel: '확인',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('renders nothing when open=false', () => {
    const { container } = render(<ConfirmStepModal {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title, description, and confirm button when open', () => {
    render(<ConfirmStepModal {...baseProps} open />);
    expect(screen.getByText('취소할까요?')).toBeTruthy();
    expect(screen.getByText('되돌아갑니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '머무르기' })).toBeTruthy();
  });

  it('renders custom cancelLabel', () => {
    render(<ConfirmStepModal {...baseProps} open cancelLabel="아니요" />);
    expect(screen.getByRole('button', { name: '아니요' })).toBeTruthy();
  });

  // Rewind confirms (step 6/7) commit in the amber tone; the ordinary confirm stays blue.
  // Either way the dialog carries exactly one filled button.
  it('tone=warning swaps the confirm fill to amber, default keeps the primary blue', () => {
    const { unmount } = render(<ConfirmStepModal {...baseProps} open tone="warning" />);
    const warn = screen.getByRole('button', { name: '확인' });
    expect(warn.className).toContain('bg-[#B45309]');
    expect(warn.className).not.toContain('bg-[#0064FF]');
    unmount();

    render(<ConfirmStepModal {...baseProps} open />);
    expect(screen.getByRole('button', { name: '확인' }).className).toContain('bg-[#0064FF]');
  });

  // WCAG dialog pattern: focus moves into the dialog on open (safe cancel side)
  // and returns to the trigger element when the dialog closes.
  it('moves focus to cancel on open and restores the trigger on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = '열기';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<ConfirmStepModal {...baseProps} open />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '머무르기' }));

    rerender(<ConfirmStepModal {...baseProps} open={false} />);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('shows a spinner inside the confirm button while pending', () => {
    const { container, rerender } = render(<ConfirmStepModal {...baseProps} open />);
    expect(container.querySelector('.animate-spin')).toBeNull();
    rerender(<ConfirmStepModal {...baseProps} open isPending />);
    const confirm = screen.getByRole('button', { name: '확인' });
    expect(confirm.querySelector('.animate-spin')).toBeTruthy();
  });

  // Keyboard focus gets the branded #0064FF halo; mouse clicks stay ring-free
  // (focus-visible, not focus).
  it('carries the focus-visible ring grammar on both buttons', () => {
    render(<ConfirmStepModal {...baseProps} open />);
    for (const name of ['머무르기', '확인']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('focus-visible:ring-[#0064FF]');
    }
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    render(<ConfirmStepModal {...baseProps} open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('confirm-step-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal body is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmStepModal {...baseProps} open onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<ConfirmStepModal {...baseProps} open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmStepModal {...baseProps} open onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons and ignores Escape when isPending=true', () => {
    const onClose = vi.fn();
    render(<ConfirmStepModal {...baseProps} open onClose={onClose} isPending />);
    expect(screen.getByRole('button', { name: '확인' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '머무르기' })).toHaveProperty('disabled', true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the blue primary confirm on the compact .btn scale', () => {
    render(<ConfirmStepModal {...baseProps} open />);
    const confirmBtn = screen.getByRole('button', { name: '확인' });
    expect(confirmBtn.className).toContain('bg-[#0064FF]');
    expect(confirmBtn.className).toContain('h-10');
  });

  it('applies the v16 toss modal title styling', () => {
    render(<ConfirmStepModal {...baseProps} open />);
    const title = screen.getByText('취소할까요?');
    expect(title.className).toContain(modalStyles.toss.title);
  });

  // Body slot: confirms that carry content (approval submit stats) render it
  // between the description and the footer, and widen to 560px.
  it('renders body children and the wide width when provided', () => {
    render(
      <ConfirmStepModal {...baseProps} open wide>
        <div data-testid="confirm-body">stats</div>
      </ConfirmStepModal>,
    );
    expect(screen.getByTestId('confirm-body')).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[560px]');
  });

  // The result frame takes over the body AND the footer — nothing from the question
  // survives into the answer.
  it('result replaces the confirm body and footer', () => {
    render(
      <ConfirmStepModal
        {...baseProps}
        open
        result={{ kind: 'success', title: '보냈어요', description: '곧 이동해요.' }}
      >
        <div data-testid="confirm-body">stats</div>
      </ConfirmStepModal>,
    );
    expect(screen.getByText('보냈어요')).toBeTruthy();
    expect(screen.queryByText('취소할까요?')).toBeNull();
    expect(screen.queryByTestId('confirm-body')).toBeNull();
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull();
    expect(screen.queryByRole('button', { name: '머무르기' })).toBeNull();
  });

  // The transition is already committed while the success frame stands — a close path
  // that "works" would dismiss the dialog and still land on the next step.
  it('locks Escape and the backdrop on the success frame, releases them on the error frame', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ConfirmStepModal
        {...baseProps}
        open
        onClose={onClose}
        result={{ kind: 'success', title: '보냈어요', description: '곧 이동해요.' }}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('confirm-step-modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <ConfirmStepModal
        {...baseProps}
        open
        onClose={onClose}
        result={{ kind: 'error', title: '못 보냈어요', description: '다시 시도해 주세요.' }}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The elements that held focus are unmounted with the confirm body, so the error
  // frame's own commit button has to take it.
  it('moves focus to 다시 요청하기 when the error frame appears', () => {
    const { rerender } = render(<ConfirmStepModal {...baseProps} open />);
    rerender(
      <ConfirmStepModal
        {...baseProps}
        open
        onRetry={vi.fn()}
        result={{
          kind: 'error',
          title: '못 보냈어요',
          description: '다시 시도해 주세요.',
          reason: '요청이 만료됐어요.',
        }}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '다시 요청하기' }));
    expect(screen.getByText('요청이 만료됐어요.')).toBeTruthy();
  });

  // 성공 프레임에는 누를 것이 없다 — 포커스를 쥔 확인 버튼이 본문과 함께 사라지므로,
  // 프레임 자신이 받지 않으면 포커스가 body 로 떨어지고 Tab 이 모달 뒤 페이지를 걷는다.
  it('keeps focus inside the dialog on the success frame', () => {
    const { rerender } = render(<ConfirmStepModal {...baseProps} open />);
    rerender(
      <ConfirmStepModal
        {...baseProps}
        open
        result={{ kind: 'success', title: '보냈어요', description: '곧 이동해요.' }}
      />,
    );
    const frame = screen.getByRole('status');
    expect(document.activeElement).toBe(frame);
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    // 누를 것이 없다고 Tab 이 밖으로 새어나가서는 안 된다 — preventDefault 로 삼킨다.
    const notPrevented = fireEvent.keyDown(document, { key: 'Tab' });
    expect(notPrevented).toBe(false);
  });

  // 실패는 기다리던 사용자를 끊어야 하고, 성공은 끊을 것이 없다.
  it('announces the result — assertive on error, polite on success', () => {
    const { rerender } = render(
      <ConfirmStepModal
        {...baseProps}
        open
        result={{ kind: 'success', title: '보냈어요', description: '곧 이동해요.' }}
      />,
    );
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');

    rerender(
      <ConfirmStepModal
        {...baseProps}
        open
        result={{ kind: 'error', title: '못 보냈어요', description: '다시 시도해 주세요.' }}
      />,
    );
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
  });
});
