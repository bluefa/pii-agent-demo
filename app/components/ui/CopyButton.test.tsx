// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopyButton } from '@/app/components/ui/CopyButton';

describe('CopyButton', () => {
  it('writes value to clipboard on click', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton value="abc-123" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abc-123'));
  });

  it('uses provided label as aria-label', () => {
    render(<CopyButton value="abc" label="리소스 ID 복사" />);
    expect(screen.getByRole('button', { name: '리소스 ID 복사' })).toBeTruthy();
  });

  it('defaults aria-label to "<value> 복사"', () => {
    render(<CopyButton value="r-99" />);
    expect(screen.getByRole('button', { name: 'r-99 복사' })).toBeTruthy();
  });

  it('flips between Copy and Check icons across the 1.5s reset cycle', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(<CopyButton value="x" />);

    // CopyIcon renders a <rect>; CheckIcon does not — used as the state probe.
    expect(container.querySelector('rect')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(container.querySelector('rect')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(container.querySelector('rect')).not.toBeNull();

    vi.useRealTimers();
  });
});
