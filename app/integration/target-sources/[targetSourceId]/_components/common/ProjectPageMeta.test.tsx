// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProcessStatus, type TargetSource } from '@/lib/types';
import { ProjectPageMeta } from '@/app/integration/target-sources/[targetSourceId]/_components/common/ProjectPageMeta';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common/project-identity';

const projectFixture: TargetSource = {
  id: 'proj-1',
  targetSourceId: 1008,
  projectCode: 'AWS-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.INSTALLATION_COMPLETE,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Big Data Platform',
  description: 'desc',
  isRejected: false,
  cloudProvider: 'AWS',
};

const awsIdentity: ProjectIdentity = {
  cloudProvider: 'AWS',
  monitoringMethod: 'AWS Agent',
  jiraLink: null,
  identifiers: [{ label: 'Account ID', value: '482915736204', mono: true }],
};

const idcIdentity: ProjectIdentity = {
  cloudProvider: 'IDC',
  monitoringMethod: 'IDC Agent',
  jiraLink: null,
  identifiers: [],
};

describe('ProjectPageMeta — collab-channel chip', () => {
  it('renders the collab chip with the v16 fallback ticket when no Jira link', () => {
    render(<ProjectPageMeta project={projectFixture} providerLabel="AWS Infrastructure" identity={awsIdentity} />);
    expect(screen.getByText('협업 채널')).toBeTruthy();
    expect(screen.getByText('BDCDIP-1353')).toBeTruthy();
  });

  it('uses the Jira ticket key + href when a Jira link is present', () => {
    const linked: ProjectIdentity = { ...awsIdentity, jiraLink: 'https://jira.example.com/browse/PII-42' };
    render(<ProjectPageMeta project={projectFixture} providerLabel="AWS Infrastructure" identity={linked} />);
    const chip = screen.getByTitle('협업 채널 — Jira에서 논의하기') as HTMLAnchorElement;
    expect(chip.getAttribute('href')).toBe('https://jira.example.com/browse/PII-42');
    // chip ticket value (collab chip), distinct from the identity-field Jira link
    expect(screen.getAllByText('PII-42').length).toBeGreaterThan(0);
  });

  it('renders the chip before the page action', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        providerLabel="AWS Infrastructure"
        identity={awsIdentity}
        action={<button type="button">인프라 삭제</button>}
      />,
    );
    const chip = screen.getByTitle('협업 채널 — Jira에서 논의하기');
    const action = screen.getByRole('button', { name: '인프라 삭제' });
    // chip precedes the action in DOM order (Node.DOCUMENT_POSITION_FOLLOWING = 4)
    expect(chip.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('ProjectPageMeta — IDC sub-label suppression', () => {
  it('hides the "Cloud Provider" sub-label for IDC', () => {
    render(<ProjectPageMeta project={projectFixture} providerLabel="IDC Infrastructure" identity={idcIdentity} />);
    expect(screen.queryByText('Cloud Provider')).toBeNull();
  });

  it('shows the "Cloud Provider" sub-label for cloud providers', () => {
    render(<ProjectPageMeta project={projectFixture} providerLabel="AWS Infrastructure" identity={awsIdentity} />);
    expect(screen.getByText('Cloud Provider')).toBeTruthy();
  });
});
