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
});
