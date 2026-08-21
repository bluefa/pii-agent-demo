// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
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

/**
 * The meta blocks live behind the 「설치 대상 정보」 disclosure and the header opens
 * folded, so every assertion about their content has to open it first — a bare
 * `render` sees a two-tier header and nothing else.
 */
const renderOpen = (props: Parameters<typeof ProjectPageMeta>[0]) => {
  const result = render(<ProjectPageMeta {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /설치 대상 정보/ }));
  return result;
};

describe('ProjectPageMeta — 설치 대상 정보 disclosure', () => {
  it('folds the meta away by default — the header is title + progress band', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.queryByText('클라우드 정보')).toBeNull();
    expect(screen.queryByText('Account ID')).toBeNull();
    expect(screen.queryByText('설명')).toBeNull();
    // The two tiers that survive the fold.
    expect(screen.getByRole('heading', { name: 'PII Agent 설치' })).toBeTruthy();
    expect(screen.getByTestId('process-progress-bar')).toBeTruthy();
  });

  it('makes the whole 설치 대상 line the control, facts included', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const toggle = screen.getByRole('button', { name: /설치 대상 정보/ });
    // The summary IS the head of the disclosure — the facts on it are inert text
    // inside the press, not a row the press sits beside.
    for (const fact of ['설치 대상', 'Service A', '서비스 코드', 'SERVICE-A']) {
      expect(toggle.contains(screen.getByText(fact))).toBe(true);
    }
    // …and nothing inside it steals the click.
    expect(toggle.querySelector('button, a, input')).toBeNull();
  });

  it('opens and closes on the toggle, reporting state to assistive tech', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const toggle = screen.getByRole('button', { name: /설치 대상 정보/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // aria-controls has to name a box that exists, or the association is a lie.
    const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(body).toBeTruthy();
    // Head and body are one object: the body opens inside the group, not after it.
    expect(toggle.parentElement?.contains(body as Node)).toBe(true);
    expect(screen.getByText('클라우드 정보')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('클라우드 정보')).toBeNull();
  });
});

describe('ProjectPageMeta — title row', () => {
  it('titles the page by its job and demotes the service to the 설치 대상 line', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.getByRole('heading', { name: 'PII Agent 설치' })).toBeTruthy();
    expect(screen.getByText('설치 대상')).toBeTruthy();
    expect(screen.getByText('Service A')).toBeTruthy();
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
    renderOpen({ project: projectFixture, identity: awsIdentity });
    expect(screen.getByText('설명')).toBeTruthy();
    expect(screen.getByText('desc')).toBeTruthy();
  });

  it('skips the block entirely (label included) when the description is empty', () => {
    renderOpen({ project: { ...projectFixture, description: '  ' }, identity: awsIdentity });
    expect(screen.queryByText('설명')).toBeNull();
  });
});

describe('ProjectPageMeta — provider group', () => {
  it('shows "AWS Cloud" with its account id and install mode under 클라우드 정보', () => {
    renderOpen({ project: projectFixture, identity: awsIdentity });
    expect(screen.getByText('클라우드 정보')).toBeTruthy();
    expect(screen.getByText('AWS Cloud')).toBeTruthy();
    expect(screen.getByText('482915736204')).toBeTruthy();
    expect(screen.getByText('자동 설치')).toBeTruthy();
    // The mode's meaning stays on-screen, not behind a tooltip.
    expect(screen.getByText('Terraform 권한 위임')).toBeTruthy();
  });

  it('renders manual mode with its own explanation', () => {
    renderOpen({
      project: projectFixture,
      identity: { ...awsIdentity, installMode: 'manual' },
    });
    expect(screen.getByText('수동 설치')).toBeTruthy();
    expect(screen.getByText('설치 스크립트 직접 실행')).toBeTruthy();
  });

  it('hides the install-mode row when the identity carries none', () => {
    renderOpen({
      project: projectFixture,
      identity: { ...awsIdentity, installMode: undefined },
    });
    expect(screen.queryByText('설치 모드')).toBeNull();
  });

  it('drops identifier rows whose value is absent instead of rendering "-"', () => {
    renderOpen({
      project: projectFixture,
      identity: {
        cloudProvider: 'AWS',
        identifiers: [{ label: 'Account ID', value: null, mono: true }],
      },
    });
    expect(screen.queryByText('Account ID')).toBeNull();
    expect(screen.queryByText('-')).toBeNull();
  });

  it('IDC reads 인프라 정보 with the 사내망 gloss and no identifiers', () => {
    renderOpen({ project: { ...projectFixture, cloudProvider: 'IDC' }, identity: idcIdentity });
    expect(screen.getByText('인프라 정보')).toBeTruthy();
    expect(screen.getByText('IDC')).toBeTruthy();
    expect(screen.getByText('사내망')).toBeTruthy();
    expect(screen.queryByText('Cloud Provider')).toBeNull();
  });

  it('an SDU account reads 데이터 제공 · direct upload, over its underlying CSP', () => {
    renderOpen({ project: { ...projectFixture, isSduType: true }, identity: awsIdentity });
    expect(screen.getByText('데이터 제공')).toBeTruthy();
    expect(screen.getByText('SDU')).toBeTruthy();
    expect(screen.getByText('연동 방식')).toBeTruthy();
    expect(screen.getByText('고객사가 데이터를 직접 업로드')).toBeTruthy();
    expect(screen.queryByText('AWS Cloud')).toBeNull();
  });
});

/**
 * The header shipped with the provider name reading 10px above the identifier
 * beside it, and nothing in this suite noticed — every other assertion here is a
 * text-presence query, which passes at any alignment. These are the class
 * agreements the one-line-per-tier layout rests on; each one, broken alone, puts
 * the two lines back out of register.
 */
const utilityOn = (start: Element | null, prefix: string): string | null => {
  for (let el: Element | null = start; el; el = el.parentElement) {
    const hit = String(el.className)
      .split(/\s+/)
      .find((c) => c.startsWith(prefix));
    if (hit) return hit;
  }
  return null;
};

describe('ProjectPageMeta — one line per tier', () => {
  it('gives the provider name and the identifier value one shared line box', () => {
    renderOpen({ project: projectFixture, identity: awsIdentity });
    const provider = screen.getByText('AWS Cloud');
    const value = screen.getByText('482915736204');

    // Equal box height → equal centre. The provider's box is sized by its 30px
    // icon badge; a shorter value box centres higher and the two lines split.
    expect(utilityOn(provider, 'min-h-')).toBe('min-h-[30px]');
    expect(utilityOn(value, 'min-h-')).toBe('min-h-[30px]');

    // Equal centre is not equal baseline. Both line boxes must also declare the
    // same leading, or the glyphs sit ~1px apart inside matching boxes.
    expect(utilityOn(provider, 'leading-')).toBe(utilityOn(value, 'leading-'));
    expect(utilityOn(provider, 'leading-')).not.toBeNull();
  });

  it('binds both label stacks to their value at the same gap', () => {
    renderOpen({ project: projectFixture, identity: awsIdentity });

    // The group eyebrow rides on the kv label line. It only stays there while the
    // two stacks push their value down by the same amount.
    expect(utilityOn(screen.getByText('클라우드 정보'), 'gap-')).toBe(
      utilityOn(screen.getByText('Account ID'), 'gap-'),
    );
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
