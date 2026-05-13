// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScanPill } from '@/app/components/ui/ScanPill';

describe('ScanPill', () => {
  it('renders the Integrated label and a dot indicator for state="integrated"', () => {
    const { container } = render(<ScanPill state="integrated" />);
    expect(screen.getByText('Integrated')).toBeTruthy();
    // dot is a span sibling with rounded-full + small dimensions
    const dots = container.querySelectorAll('span.rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Pending label and a dot indicator for state="pending"', () => {
    const { container } = render(<ScanPill state="pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
    const dots = container.querySelectorAll('span.rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('renders just the em-dash text without a chip frame for state="none"', () => {
    const { container } = render(<ScanPill state="none" />);
    expect(screen.getByText('—')).toBeTruthy();
    // No rounded-full chip frame for the none state
    const dots = container.querySelectorAll('span.rounded-full');
    expect(dots.length).toBe(0);
  });
});
