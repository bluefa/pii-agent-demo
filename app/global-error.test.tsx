// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/client-error-report', () => ({
  reportClientError: vi.fn(),
}));

import GlobalError from '@/app/global-error';
import { reportClientError } from '@/lib/client-error-report';

const errorWith = (message: string, digest?: string): Error & { digest?: string } =>
  Object.assign(new Error(message), { digest });

// global-error renders its own <html>/<body>; jsdom tolerates the nested
// document nodes for assertion purposes.
describe('GlobalError boundary', () => {
  it('renders the Korean fallback copy and reports on mount', () => {
    render(<GlobalError error={errorWith('root layout crashed', 'g-1')} reset={() => {}} />);
    expect(screen.getByText('일시적인 오류가 발생했습니다')).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'global', message: 'root layout crashed', digest: 'g-1' }),
    );
  });

  it('calls reset when 다시 시도 is clicked', () => {
    const reset = vi.fn();
    render(<GlobalError error={errorWith('x')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
