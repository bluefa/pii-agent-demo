// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => <div data-testid="guide-card" />,
}));

// The management footer renders DeleteInfrastructureButton, which needs the
// toast context — mock it so the panel renders standalone.
vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/common/DeleteInfrastructureButton',
  () => ({
    DeleteInfrastructureButton: () => <button type="button">인프라 삭제</button>,
  }),
);

import { GuidePanel } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';

const baseProps = {
  slotKey: null,
  monitoringLabel: 'AWS Agent',
  monitoringAccent: '#FF9900',
} as const;

describe('GuidePanel — collab-channel card states', () => {
  it('renders the explicit 미연결 state when no Jira ticket is mapped (404 → null)', () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
    expect(screen.getByText('아직 연결된 협업 채널이 없어요')).toBeTruthy();
    expect(screen.queryByTitle('협업 채널 — Jira에서 논의하기')).toBeNull();
  });

  it('renders a distinct error row on fetch failure — never the 미연결 state', () => {
    render(<GuidePanel {...baseProps} jiraTicket="error" />);
    expect(screen.getByText('협업 채널 정보를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('아직 연결된 협업 채널이 없어요')).toBeNull();
  });

  it('renders neither row while loading', () => {
    render(<GuidePanel {...baseProps} jiraTicket="loading" />);
    expect(screen.queryByText('아직 연결된 협업 채널이 없어요')).toBeNull();
    expect(screen.queryByText('협업 채널 정보를 불러오지 못했어요')).toBeNull();
  });

  it('shows the mapped issue key WITHOUT a link when no Jira base URL is configured', () => {
    // NEXT_PUBLIC_JIRA_BROWSE_BASE is unset in tests — a mapped ticket must not
    // point at a fabricated destination.
    render(<GuidePanel {...baseProps} jiraTicket={{ issueKey: 'PII-42' }} />);
    expect(screen.getByText('PII-42')).toBeTruthy();
    expect(screen.queryByTitle('협업 채널 — Jira에서 논의하기')).toBeNull();
  });
});

describe('GuidePanel — management footer', () => {
  it('renders the monitoring pill and the delete action pinned in the rail footer', () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    expect(screen.getByText('모니터링')).toBeTruthy();
    expect(screen.getByText('AWS Agent')).toBeTruthy();
    expect(screen.getByRole('button', { name: '인프라 삭제' })).toBeTruthy();
  });
});
