// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScanPill } from '@/app/components/ui/ScanPill';

describe('ScanPill', () => {
  it.each([
    ['new', 'New'],
    ['changed', 'Changed'],
    ['kept', 'Kept'],
    ['integrated', 'Integrated'],
  ] as const)('renders state="%s" with label "%s"', (state, label) => {
    render(<ScanPill state={state} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('renders just the em-dash for state="none"', () => {
    render(<ScanPill state="none" />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders no dot indicator (v15 .scan-pill has no dot)', () => {
    const { container } = render(<ScanPill state="integrated" />);
    expect(container.querySelectorAll('span.rounded-full').length).toBe(0);
  });
});
