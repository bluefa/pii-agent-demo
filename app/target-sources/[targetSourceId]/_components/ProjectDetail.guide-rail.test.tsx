// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type TargetSource } from '@/lib/types';

vi.mock('@/app/target-sources/[targetSourceId]/_components/ServiceListPanel', () => ({
  ServiceListPanel: () => null,
}));

vi.mock('@/app/target-sources/[targetSourceId]/_components/aws', () => ({
  AwsProjectPage: () => <div data-testid="aws-page" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/azure', () => ({
  AzureProjectPage: () => <div data-testid="azure-page" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/gcp', () => ({
  GcpProjectPage: () => <div data-testid="gcp-page" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/idc', () => ({
  IdcProjectPage: () => <div data-testid="idc-page" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/sdu', () => ({
  SduProjectPage: () => <div data-testid="sdu-page" />,
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: vi.fn(() => 'stub-slot-key'),
  resolveProjectStepSlot: vi.fn(() => 'stub-slot-key'),
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/common',
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import('@/app/target-sources/[targetSourceId]/_components/common')
    >();
    return {
      ...mod,
      // ⛔ `initialCollapsed` is captured too, and it is not decoration. The cookie is
      // read in `page.tsx` and used in `GuidePanel`, so THIS component is the only hop
      // between them — and a hop nobody asserts is a hop that can be cut. Dropping it
      // here (`initialCollapsed={null}`) type-checks, because `null` is a legal value,
      // and puts the 320px→56px reload flash back with the whole suite still green.
      GuidePanel: ({
        slotKey,
        initialCollapsed,
      }: {
        slotKey: string | null;
        initialCollapsed?: boolean | null;
      }) => (
        <div
          data-testid="guide-panel"
          data-slot-key={slotKey ?? ''}
          data-initial-collapsed={String(initialCollapsed)}
        />
      ),
    };
  },
);

import { ProjectDetail } from '@/app/target-sources/[targetSourceId]/_components/ProjectDetail';

const azureFixture: TargetSource = {
  isTerraformExecutionGranted: false,
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Azure PII Agent - DB integration',
  description: 'Azure SQL, PostgreSQL, MySQL resources',
  isRejected: false,
  cloudProvider: 'Azure',
  tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
};

// Lifted from the per-step guide-card tests: the guide mounts once as the
// full-height right rail (GuidePanel) with the slot key resolved from the project.
describe('ProjectDetail guide rail', () => {
  it('renders the GuidePanel rail next to the provider page with the resolved slot key', () => {
    render(<ProjectDetail initialProject={azureFixture} jiraTicket={null} railCollapsed={null} />);

    expect(screen.getByTestId('azure-page')).toBeTruthy();
    const panel = screen.getByTestId('guide-panel');
    expect(panel.getAttribute('data-slot-key')).toBe('stub-slot-key');
  });

  // The fold preference survives every hop or it survives none: the server parses the
  // cookie, this component is the only thing between that parse and the rail, and the
  // rail's first paint is the whole reason the preference is a cookie at all.
  //
  // ⛔ All three values, not just one. `null` is what "no cookie" looks like, so a hop
  // that hard-codes it is invisible to a test that only ever passes `null` — which is
  // exactly what the two tests around this one do.
  it.each([
    ['collapsed', true],
    ['open', false],
    ['no preference', null],
  ] as const)('hands the server-parsed cookie to the rail — %s', (_name, railCollapsed) => {
    render(
      <ProjectDetail initialProject={azureFixture} jiraTicket={null} railCollapsed={railCollapsed} />,
    );

    expect(screen.getByTestId('guide-panel').getAttribute('data-initial-collapsed')).toBe(
      String(railCollapsed),
    );
  });
});

/**
 * SDU used to be a hard gate here: the whole layout was replaced by a full-page
 * 「아직 지원하지 않는 서비스 타입입니다」 notice, rail and all. The flow exists now, so the
 * SDU page takes the same slot every other provider page takes.
 *
 * The two things worth pinning are the two that a provider `switch` gets wrong on its own.
 * An SDU target still carries a real `cloudProvider` — these fixtures say `AWS` — so a
 * branch placed after the switch never runs; and the guide rail has to come back, because
 * the reason it was withheld (「설치 진행에 대해 할 말이 없다」) expired with the notice.
 */
describe('ProjectDetail — SDU', () => {
  const sduFixture: TargetSource = { ...azureFixture, cloudProvider: 'AWS', isSduType: true };

  it('renders the SDU page instead of the underlying provider’s', () => {
    render(<ProjectDetail initialProject={sduFixture} jiraTicket={null} railCollapsed={null} />);

    expect(screen.getByTestId('sdu-page')).toBeTruthy();
    // ⛔ Not the AWS page, even though `cloudProvider` says AWS. SDU names how the data
    // arrives, not where it lives.
    expect(screen.queryByTestId('aws-page')).toBeNull();
  });

  it('gives an SDU target the guide rail back', () => {
    render(<ProjectDetail initialProject={sduFixture} jiraTicket={null} railCollapsed={null} />);

    expect(screen.getByTestId('guide-panel').getAttribute('data-slot-key')).toBe('stub-slot-key');
  });

  it('keeps a cloud target on its provider page', () => {
    // The other half of the branch: the flag is optional, so its absence must not start
    // routing every AWS target into the SDU page.
    render(
      <ProjectDetail
        initialProject={{ ...azureFixture, cloudProvider: 'AWS' }}
        jiraTicket={null}
        railCollapsed={null}
      />,
    );

    expect(screen.getByTestId('aws-page')).toBeTruthy();
    expect(screen.queryByTestId('sdu-page')).toBeNull();
  });
});

// The rails only stay put if the middle column contains its own absolutes. Drop
// `relative` and an `sr-only` live region deep in a step table resolves against
// the initial containing block instead, stretching the ROOT scroll area until the
// whole page — rails, top nav — scrolls off screen.
describe('ProjectDetail scroll containment', () => {
  it('positions the scrolling column so absolute descendants cannot escape it', () => {
    const { container } = render(
      <ProjectDetail initialProject={azureFixture} jiraTicket={null} railCollapsed={null} />,
    );

    const column = container.querySelector('div.overflow-auto');
    expect(column).toBeTruthy();
    expect(column?.className.split(/\s+/)).toContain('relative');
  });
});
