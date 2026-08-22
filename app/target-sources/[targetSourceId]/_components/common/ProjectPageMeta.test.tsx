// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
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

const summaryBar = () => screen.getByRole('button', { name: /설치 대상 정보/ });

/**
 * 시안 C put the provider and the account on the summary bar, and the block below
 * still details them — a head summarising its own body. So the two now name some
 * of the same facts, and every open-state assertion has to say which one it means.
 */
const metaBlock = () => {
  const body = document.getElementById(summaryBar().getAttribute('aria-controls') ?? '');
  if (!body) throw new Error('meta block is closed');
  return within(body);
};

describe('ProjectPageMeta — 설치 대상 정보 disclosure', () => {
  it('folds the meta away by default — the header is path + scope bar + progress band', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.queryByText('클라우드 정보')).toBeNull();
    expect(screen.queryByText('설명')).toBeNull();
    // The tiers that survive the fold.
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByTestId('process-progress-bar')).toBeTruthy();
  });

  it('keeps the provider and the account on the folded bar (오너 4차 지시)', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const toggle = summaryBar();
    // The summary IS the head of the disclosure — the facts on it are inert text
    // inside the press, not a row the press sits beside. Which facts changed with
    // 시안 C: the scope (provider · account · code), never the name.
    for (const fact of ['AWS Cloud', 'Account ID', '482915736204', '서비스 코드', 'SERVICE-A']) {
      expect(within(toggle).getByText(fact)).toBeTruthy();
    }
    // …and nothing inside it steals the click.
    expect(toggle.querySelector('button, a, input')).toBeNull();
  });

  it('holds the scope to one line — the account is the only slot that may shrink', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const toggle = summaryBar();
    // Wrapping is the failure 시안 C exists to remove: a long service name used to
    // take this bar from 40px to 69px, and the facts get 542px at the 1360 column.
    const facts = within(toggle).getByText('AWS Cloud').parentElement as HTMLElement;
    expect(facts.className).toContain('flex-nowrap');
    // Which only holds while overflow has exactly one place to go.
    const account = within(toggle).getByText('482915736204');
    expect(account.className).toContain('min-w-0');
    expect(account.className).toContain('truncate');
    expect(account.getAttribute('title')).toBe('482915736204');
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

describe('ProjectPageMeta — path heading', () => {
  it('states the job at the weight of a location, not a 24px title', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('PII Agent 설치/Service A/#1008');
  });

  it('clamps the service name — no contract maximum backs it', () => {
    // swagger `service_name` declares no maxLength, so the only guarantee this
    // line can make about width is the one it enforces itself.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const name = within(screen.getByRole('heading', { level: 1 })).getByText('Service A');
    expect(name.className).toContain('truncate');
    expect(name.className).toContain('max-w-[280px]');
    expect(name.getAttribute('title')).toBe('Service A');
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
  it('records the account id and install mode under 클라우드 정보', () => {
    renderOpen({ project: projectFixture, identity: awsIdentity });
    const block = metaBlock();
    expect(block.getByText('클라우드 정보')).toBeTruthy();
    expect(block.getByText('482915736204')).toBeTruthy();
    expect(block.getByText('자동 설치')).toBeTruthy();
    // The mode's meaning stays on-screen, not behind a tooltip.
    expect(block.getByText('Terraform 권한 위임')).toBeTruthy();
    // The provider is stated once, on the bar. Repeating it here put the same
    // glyph and name 60px apart the moment the block opened.
    expect(block.queryByText('AWS Cloud')).toBeNull();
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

  it('IDC carries its 사내망 gloss on the bar and drops the group whole', () => {
    renderOpen({ project: { ...projectFixture, cloudProvider: 'IDC' }, identity: idcIdentity });
    const bar = within(summaryBar());
    expect(bar.getByText('IDC')).toBeTruthy();
    expect(bar.getByText('사내망')).toBeTruthy();
    // No account and no install mode: a labelled group with nothing under it
    // states less than no group at all.
    expect(screen.queryByText('인프라 정보')).toBeNull();
    expect(screen.queryByText('Cloud Provider')).toBeNull();
  });

  it('an SDU account reads 데이터 제공 · direct upload, over its underlying CSP', () => {
    renderOpen({ project: { ...projectFixture, isSduType: true }, identity: awsIdentity });
    const block = metaBlock();
    expect(within(summaryBar()).getByText('SDU')).toBeTruthy();
    expect(block.getByText('데이터 제공')).toBeTruthy();
    expect(block.getByText('연동 방식')).toBeTruthy();
    expect(block.getByText('고객사가 데이터를 직접 업로드')).toBeTruthy();
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
  it('gives the provider name and the account one shared line box on the bar', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const bar = within(summaryBar());
    const provider = bar.getByText('AWS Cloud');
    const value = bar.getByText('482915736204');

    // Same size, or one of them sets the bar's 24px content height alone.
    expect(provider.className).toContain('text-[14px]');
    expect(value.className).toContain('text-[14px]');

    // Same size is not the same baseline. Both line boxes must also declare the
    // same leading, or the glyphs sit ~1px apart on a line 24px tall.
    expect(utilityOn(provider, 'leading-')).toBe(utilityOn(value, 'leading-'));
    expect(utilityOn(provider, 'leading-')).not.toBeNull();
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
