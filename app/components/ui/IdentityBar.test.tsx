// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { IdentityBar } from '@/app/components/ui/IdentityBar';

const baseProps = {
  accent: '#0064FF',
  providerName: 'IDC Infrastructure',
  icon: <svg data-testid="provider-icon" />,
  fields: [],
};

describe('IdentityBar provider sub-label', () => {
  it('renders the sub-label when provided', () => {
    render(<IdentityBar {...baseProps} providerSub="Cloud Provider" />);
    expect(screen.getByText('Cloud Provider')).toBeTruthy();
  });

  it('omits the sub-label element when providerSub is undefined (IDC)', () => {
    render(<IdentityBar {...baseProps} providerSub={undefined} />);
    expect(screen.queryByText('Cloud Provider')).toBeNull();
  });
});
