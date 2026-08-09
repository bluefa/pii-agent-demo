// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type TargetSource } from '@/lib/types';

// The flat header mounts the quiet stepper; stub it and surface the step it receives.
vi.mock('@/app/components/features/process-status', () => ({
  InstallationProcessProgressBar: ({ currentStep }: { currentStep: unknown }) => (
    <div data-testid="process-progress-bar" data-step={String(currentStep)} />
  ),
}));

import { ProjectPageMeta } from '@/app/target-sources/[targetSourceId]/_components/common/ProjectPageMeta';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';

const projectFixture: TargetSource = {
  isTerraformExecutionGranted: false,
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
  identifiers: [{ label: 'Account ID', value: '482915736204', mono: true }],
  installMode: 'auto',
};

const idcIdentity: ProjectIdentity = {
  cloudProvider: 'IDC',
  identifiers: [],
};

describe('ProjectPageMeta — title row', () => {
  it('labels the service code explicitly instead of bare parens', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.getByRole('heading', { name: 'Service A' })).toBeTruthy();
    expect(screen.getByText('서비스 코드')).toBeTruthy();
    expect(screen.getByText('SERVICE-A')).toBeTruthy();
  });

  it('renders the page action', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={awsIdentity}
        action={<button type="button">인프라 삭제</button>}
      />,
    );
    expect(screen.getByRole('button', { name: '인프라 삭제' })).toBeTruthy();
  });
});

describe('ProjectPageMeta — description block', () => {
  it('renders the 설명 block when the target source has a description', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.getByText('설명')).toBeTruthy();
    expect(screen.getByText('desc')).toBeTruthy();
  });

  it('skips the block entirely (label included) when the description is empty', () => {
    render(
      <ProjectPageMeta project={{ ...projectFixture, description: '  ' }} identity={awsIdentity} />,
    );
    expect(screen.queryByText('설명')).toBeNull();
  });
});

describe('ProjectPageMeta — provider group', () => {
  it('shows "AWS Cloud" with its account id and install mode under 클라우드 정보', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.getByText('클라우드 정보')).toBeTruthy();
    expect(screen.getByText('AWS Cloud')).toBeTruthy();
    expect(screen.getByText('482915736204')).toBeTruthy();
    expect(screen.getByText('자동 설치')).toBeTruthy();
    // The mode's meaning stays on-screen, not behind a tooltip.
    expect(screen.getByText('Terraform 권한 위임')).toBeTruthy();
  });

  it('renders manual mode with its own explanation', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{ ...awsIdentity, installMode: 'manual' }}
      />,
    );
    expect(screen.getByText('수동 설치')).toBeTruthy();
    expect(screen.getByText('설치 스크립트 직접 실행')).toBeTruthy();
  });

  it('hides the install-mode row when the identity carries none', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{ ...awsIdentity, installMode: undefined }}
      />,
    );
    expect(screen.queryByText('설치 모드')).toBeNull();
  });

  it('drops identifier rows whose value is absent instead of rendering "-"', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{
          cloudProvider: 'AWS',
          identifiers: [{ label: 'Account ID', value: null, mono: true }],
        }}
      />,
    );
    expect(screen.queryByText('Account ID')).toBeNull();
    expect(screen.queryByText('-')).toBeNull();
  });

  it('IDC reads 인프라 정보 with the 사내망 gloss and no identifiers', () => {
    render(
      <ProjectPageMeta project={{ ...projectFixture, cloudProvider: 'IDC' }} identity={idcIdentity} />,
    );
    expect(screen.getByText('인프라 정보')).toBeTruthy();
    expect(screen.getByText('IDC')).toBeTruthy();
    expect(screen.getByText('사내망')).toBeTruthy();
    expect(screen.queryByText('Cloud Provider')).toBeNull();
  });

  it('an SDU account reads 데이터 제공 · direct upload, over its underlying CSP', () => {
    render(
      <ProjectPageMeta project={{ ...projectFixture, isSduType: true }} identity={awsIdentity} />,
    );
    expect(screen.getByText('데이터 제공')).toBeTruthy();
    expect(screen.getByText('SDU')).toBeTruthy();
    expect(screen.getByText('연동 방식')).toBeTruthy();
    expect(screen.getByText('고객사가 데이터를 직접 업로드')).toBeTruthy();
    expect(screen.queryByText('AWS Cloud')).toBeNull();
  });
});

describe('ProjectPageMeta — install progress', () => {
  it('mounts the stepper with the project processStatus', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.getByTestId('process-progress-bar').getAttribute('data-step')).toBe(
      String(projectFixture.processStatus),
    );
  });
});
