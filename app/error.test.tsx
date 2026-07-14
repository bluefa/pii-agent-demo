// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/client-error-report', () => ({
  reportClientError: vi.fn(),
}));

import RootError from '@/app/error';
import { reportClientError } from '@/lib/client-error-report';

const errorWith = (message: string, digest?: string): Error & { digest?: string } =>
  Object.assign(new Error(message), { digest });

describe('RootError boundary', () => {
  it('renders a generic Korean message and does not leak error.message', () => {
    render(<RootError error={errorWith('secret internal detail')} reset={() => {}} />);
    expect(screen.getByText('화면을 표시하는 중 문제가 발생했습니다')).toBeTruthy();
    expect(screen.queryByText(/secret internal detail/)).toBeNull();
  });

  it('shows the digest code when present', () => {
    render(<RootError error={errorWith('x', 'abc123')} reset={() => {}} />);
    expect(screen.getByText('오류 코드: abc123')).toBeTruthy();
  });

  it('calls reset when 다시 시도 is clicked', () => {
    const reset = vi.fn();
    render(<RootError error={errorWith('x')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('reports the error on mount', () => {
    render(<RootError error={errorWith('boom', 'd1')} reset={() => {}} />);
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'boundary', message: 'boom', digest: 'd1' }),
    );
  });
});
