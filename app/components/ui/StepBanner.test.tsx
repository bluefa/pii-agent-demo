// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { bannerStyles } from '@/lib/theme';

describe('StepBanner', () => {
  it('renders children', () => {
    render(<StepBanner>본문 텍스트</StepBanner>);
    expect(screen.getByText('본문 텍스트')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    render(
      <StepBanner icon={<svg data-testid="icon" />}>
        본문
      </StepBanner>,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('applies info variant tokens by default', () => {
    const { container } = render(<StepBanner>본문</StepBanner>);
    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toContain(bannerStyles.variants.info);
  });

  it('switches to warn variant tokens', () => {
    const { container } = render(<StepBanner variant="warn">경고</StepBanner>);
    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toContain(bannerStyles.variants.warn);
  });
});
