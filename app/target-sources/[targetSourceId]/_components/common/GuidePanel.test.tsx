// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => <div data-testid="guide-card" />,
}));

import { GuidePanel } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';

// The collab-channel entry lives in the rail footer now (moved out of the page
// header's action slot).
describe('GuidePanel — collab-channel footer card', () => {
  it('renders the help card with the v16 fallback ticket when no Jira link', () => {
    render(<GuidePanel slotKey={null} />);
    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
    expect(screen.getByText('협업 채널 링크')).toBeTruthy();
    expect(screen.getByText('BDCDIP-1353')).toBeTruthy();
  });

  it('uses the Jira ticket key + href when a Jira link is present', () => {
    render(<GuidePanel slotKey={null} jiraLink="https://jira.example.com/browse/PII-42" />);
    const link = screen.getByTitle('협업 채널 — Jira에서 논의하기') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://jira.example.com/browse/PII-42');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('PII-42')).toBeTruthy();
  });
});
