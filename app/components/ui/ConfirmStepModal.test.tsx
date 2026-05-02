// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { confirmModalStyles } from '@/lib/theme';

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

  it('renders the optional note', () => {
    render(<ConfirmStepModal {...baseProps} open note="중요 안내" />);
    expect(screen.getByText('중요 안내')).toBeTruthy();
  });

  it('applies danger button class when confirmVariant=danger', () => {
    render(<ConfirmStepModal {...baseProps} open confirmVariant="danger" />);
    const confirmBtn = screen.getByRole('button', { name: '확인' });
    expect(confirmBtn.className).toContain(confirmModalStyles.dangerOutlineButton);
  });

  it('applies warn icon class by default', () => {
    const { container } = render(<ConfirmStepModal {...baseProps} open />);
    const iconCircle = container.querySelector('[role="dialog"] > div > div');
    expect(iconCircle?.className).toContain(confirmModalStyles.iconCircle.warn);
  });
});
