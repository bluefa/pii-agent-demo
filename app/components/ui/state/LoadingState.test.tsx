// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingState } from '@/app/components/ui/state/LoadingState';

describe('LoadingState', () => {
  it('renders the default Korean label', () => {
    render(<LoadingState />);
    expect(screen.getByText('불러오는 중…')).toBeTruthy();
  });

  it('renders a custom label', () => {
    render(<LoadingState label="연동 대상을 불러오는 중…" />);
    expect(screen.getByText('연동 대상을 불러오는 중…')).toBeTruthy();
  });

  it('exposes a status live region for assistive tech', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
