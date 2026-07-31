// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type TargetSource } from '@/lib/types';

// The unified header card mounts the stepper footer; stub the animated bar and
// surface the step it receives.
vi.mock('@/app/components/features/process-status', () => ({
  InstallationProcessProgressBar: ({ currentStep }: { currentStep: unknown }) => (
    <div data-testid="process-progress-bar" data-step={String(currentStep)} />
  ),
}));

import { ProjectPageMeta } from '@/app/target-sources/[targetSourceId]/_components/common/ProjectPageMeta';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';
import { identityBarStyles } from '@/lib/theme';

// Selector for the identity-bar provider name, derived from the theme token so
// the test tracks the token instead of hardcoding its classes. (jsdom has no
// CSS.escape, so escape selector metacharacters by hand.)
const providerNameSelector = identityBarStyles.providerName
  .split(' ')
  .map((c) => `.${c.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)}`)
  .join('');

const projectFixture: TargetSource = {
  id: 'proj-1',
  targetSourceId: 1008,
  projectCode: 'AWS-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
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
  jiraLink: null,
  identifiers: [{ label: 'Account ID', value: '482915736204', mono: true }],
};

const idcIdentity: ProjectIdentity = {
  cloudProvider: 'IDC',
  jiraLink: null,
  identifiers: [],
};

describe('ProjectPageMeta — header action slot', () => {
  // The collab-channel entry moved to the GuidePanel rail footer (see
  // GuidePanel.test.tsx); the header action slot now carries only the page action.
  it('does not render the collab chip in the header anymore', () => {
    render(<ProjectPageMeta project={projectFixture} providerLabel="AWS Infrastructure" identity={awsIdentity} />);
    expect(screen.queryByTitle('협업 채널 — Jira에서 논의하기')).toBeNull();
  });

  it('renders the page action', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        providerLabel="AWS Infrastructure"
        identity={awsIdentity}
        action={<button type="button">인프라 삭제</button>}
      />,
    );
    expect(screen.getByRole('button', { name: '인프라 삭제' })).toBeTruthy();
  });
});

describe('ProjectPageMeta — identity-bar provider name', () => {
  it('shows the bare provider token in the identity bar, not the "{Provider} Infrastructure" label', () => {
    const { container } = render(
      <ProjectPageMeta project={projectFixture} providerLabel="AWS Infrastructure" identity={awsIdentity} />,
    );
    // identity-bar provider name (.ib-provider-name) carries the bare token only (HTML 9428).
    const providerName = container.querySelector(providerNameSelector);
    expect(providerName?.textContent).toBe('AWS');
  });

  it('renders no breadcrumb', () => {
    render(<ProjectPageMeta project={projectFixture} providerLabel="AWS Infrastructure" identity={awsIdentity} />);
    expect(screen.queryByText('AWS Infrastructure')).toBeNull();
    expect(screen.queryByText('Service List')).toBeNull();
  });

  it('shows the bare "IDC" token in the identity bar for IDC', () => {
    const { container } = render(
      <ProjectPageMeta project={projectFixture} providerLabel="IDC Infrastructure" identity={idcIdentity} />,
    );
    const providerName = container.querySelector(providerNameSelector);
    expect(providerName?.textContent).toBe('IDC');
  });
});

describe('ProjectPageMeta — unified header card', () => {
  // Lifted from the removed ProcessStatusCard: the stepper now mounts once as the
  // header card's footer, fed by the project's processStatus.
  it('mounts the stepper footer with the project processStatus', () => {
    render(<ProjectPageMeta project={projectFixture} providerLabel="AWS Infrastructure" identity={awsIdentity} />);
    expect(screen.getByTestId('process-progress-bar').getAttribute('data-step')).toBe(
      String(projectFixture.processStatus),
    );
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
