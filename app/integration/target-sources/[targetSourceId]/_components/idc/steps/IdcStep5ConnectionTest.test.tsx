// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { toIdcResourceView, type IdcResourceView } from '@/app/lib/api/idc';

// Stub the heavy chrome so only the connection-test card (strip + IdcResourceTable) renders.
vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/common', () => ({
  ProjectPageMeta: () => null,
  RejectionAlert: () => null,
}));
vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => null,
}));
vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => null,
}));
vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: () => null,
}));
vi.mock('@/app/components/ui/Tooltip', () => ({
  InfoTooltip: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn() }),
}));

// Row1 carries a pre-selected credential; the card must open every row PENDING
// (step5 is pre-test). The read source is now the submitted request
// (getIdcPreviousRequest) — the contract has no live-list GET.
const getIdcPreviousRequest = vi.fn(() => Promise.resolve<IdcResourceView[]>([]));
vi.mock('@/app/lib/api/idc', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/api/idc')>('@/app/lib/api/idc');
  return { ...actual, getIdcPreviousRequest: () => getIdcPreviousRequest() };
});

import { IdcStep5ConnectionTest } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/steps/IdcStep5ConnectionTest';

const seededRows: IdcResourceView[] = [
  toIdcResourceView(
    {
      input_format: 'IP',
      ips: ['10.20.30.40'],
      port: 3306,
      database_type: 'MYSQL',
      credential_id: 'idc_svc_mysql',
    },
    0,
  ),
  toIdcResourceView(
    {
      input_format: 'IP',
      ips: ['10.20.31.10'],
      port: 1521,
      database_type: 'ORACLE',
    },
    1,
  ),
];

const project: CloudTargetSource = {
  id: 'idc-1',
  targetSourceId: 1020,
  projectCode: 'IDC-025',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'IDC Platform',
  description: 'desc',
  isRejected: false,
  cloudProvider: 'IDC',
};

const identity: ProjectIdentity = {
  cloudProvider: 'IDC',
  monitoringMethod: 'IDC Agent',
  jiraLink: null,
  identifiers: [],
};

const renderStep = () =>
  render(
    <IdcStep5ConnectionTest
      project={project}
      identity={identity}
      providerLabel="IDC Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

describe('IdcStep5ConnectionTest — pre-test idle strip (regression)', () => {
  beforeEach(() => {
    getIdcPreviousRequest.mockResolvedValue(seededRows);
  });

  it('opens the credentialed row as Pending, ignoring the seeded SUCCESS', async () => {
    renderStep();

    // Row1 (host 10.20.30.40) keeps its pre-selected credential but reads Pending,
    // not Success — the seeded connection_status must not be carried into step5.
    const credRow = (await screen.findByText('10.20.30.40')).closest('tr')!;
    expect(within(credRow).getByRole('combobox')).toHaveProperty('value', 'idc_svc_mysql');
    expect(within(credRow).getByText('Pending')).toBeTruthy();
    expect(within(credRow).queryByText('Success')).toBeNull();
    // No row anywhere should render Success on load (pre-test).
    expect(screen.queryByText('Success')).toBeNull();
  });

  it('shows the idle conn-progress strip at 0% (nothing connected yet)', async () => {
    renderStep();

    expect(
      await screen.findByText('연결 테스트 대기 중 — Run Test를 실행해 주세요'),
    ).toBeTruthy();
    // okCount = 0 -> 0%; the seeded SUCCESS row does not count as connected.
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('keeps Run Test gated while any live row lacks a credential', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', true);
  });

  it('renders the IDC prev/next-only pager (no first/last double-chevrons)', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    expect(screen.getByLabelText('이전 페이지')).toBeTruthy();
    expect(screen.getByLabelText('다음 페이지')).toBeTruthy();
    expect(screen.queryByLabelText('처음 페이지')).toBeNull();
    expect(screen.queryByLabelText('끝 페이지')).toBeNull();
  });
});
