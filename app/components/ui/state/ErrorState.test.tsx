// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorState } from '@/app/components/ui/state/ErrorState';

describe('ErrorState', () => {
  it('renders the message', () => {
    render(<ErrorState message="연동 대상을 불러오지 못했어요." />);
    expect(screen.getByText('연동 대상을 불러오지 못했어요.')).toBeTruthy();
  });

  it('renders an optional title', () => {
    render(<ErrorState title="문제가 발생했어요" message="잠시 후 다시 시도해주세요." />);
    expect(screen.getByText('문제가 발생했어요')).toBeTruthy();
  });

  it('does not render a retry button when onRetry is omitted', () => {
    render(<ErrorState message="실패" />);
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
  });

  it('calls onRetry when the retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="실패" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
