// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';

describe('ReasonChipInline', () => {
  it('renders the reason text as the chip summary when short', () => {
    render(<ReasonChipInline reason="Stg DB" />);
    expect(screen.getByText('Stg DB')).toBeTruthy();
  });

  it('truncates long reasons with an ellipsis in the chip summary', () => {
    const longReason = 'A'.repeat(60);
    render(<ReasonChipInline reason={longReason} />);
    expect(screen.getByText(`${'A'.repeat(40)}…`)).toBeTruthy();
  });

  it('uses the explicit summary prop when provided', () => {
    render(<ReasonChipInline reason="full long reason" summary="custom short" />);
    expect(screen.getByText('custom short')).toBeTruthy();
  });

  it('exposes the full reason + meta inside the tooltip on hover', async () => {
    const longReason = 'A'.repeat(60);
    const { container } = render(
      <ReasonChipInline reason={longReason} meta="등록자: tester · 2026-05-08" />,
    );
    // Tooltip content mounts only while hovered. Trigger the container's
    // onMouseEnter then wait for the async positioning effect to settle.
    const trigger = container.firstElementChild;
    if (!trigger) throw new Error('expected Tooltip container');
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByText(longReason)).toBeTruthy();
    expect(screen.getByText('등록자: tester · 2026-05-08')).toBeTruthy();
  });
});
