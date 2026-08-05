// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { toIdcResourceView, type IdcResourceView } from '@/app/lib/api/idc';

// Stub the heavy chrome so only the connection-test card (strip + resource panel) renders.
// CardActionBar passes through so the 완료 승인 요청 CTA stays queryable.
vi.mock('@/app/target-sources/[targetSourceId]/_components/common', () => ({
  ProjectPageMeta: () => null,
  RejectionAlert: () => null,
  CardActionBar: ({ hint, children }: { hint?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {hint}
      {children}
    </div>
  ),
}));
vi.mock('@/app/components/ui/Tooltip', () => ({
  InfoTooltip: () => null,
  IdentifierTip: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn() }),
}));

// Row1 carries a pre-selected credential; the card must open every row PENDING
// (step5 is pre-test). The read source is the confirmed list
// (getIdcConfirmedResources), same as the cloud sibling.
const getIdcConfirmedResources = vi.fn(() => Promise.resolve<IdcResourceView[]>([]));
vi.mock('@/app/lib/api/idc', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/api/idc')>('@/app/lib/api/idc');
  return { ...actual, getIdcConfirmedResources: () => getIdcConfirmedResources() };
});

import { IdcStep5ConnectionTest } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep5ConnectionTest';

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
  serviceName: 'Service A',
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
    getIdcConfirmedResources.mockResolvedValue(seededRows);
  });

  it('opens pre-test: no row claims Success from the seeded status', async () => {
    renderStep();

    // Row1 (host 10.20.30.40) carries a seeded connection_status; step 5 is pre-test, so
    // nothing may read Success until a run settles. The per-row badge is gone, so the
    // strip's counts are where this is now visible.
    await screen.findByText('10.20.30.40');
    expect(screen.queryByText('Success')).toBeNull();
  });

  it('seeds the credential picker from the credential already stored on the row', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    // DB Credential left the table; the select now lives in the modal, and it must open on
    // what the row already has rather than blank out a stored pick.
    fireEvent.click(screen.getByRole('button', { name: 'DB Credential 설정' }));
    const credRow = (await screen.findAllByText('10.20.30.40'))
      .map((node) => node.closest('tr')!)
      .find((row) => within(row).queryByRole('combobox'))!;
    expect(within(credRow).getByRole('combobox')).toHaveProperty('value', 'idc_svc_mysql');
  });

  it('shows the idle conn-progress strip at 0% (nothing connected yet)', async () => {
    renderStep();

    expect(
      await screen.findByText('연결 테스트 대기 중 — Run Test를 실행해 주세요'),
    ).toBeTruthy();
    // okCount = 0 -> 0%; the seeded SUCCESS row does not count as connected.
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('sends Run Test to the credential picker while a live row lacks one', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    // Row2 has no credential. Run Test used to sit disabled with nothing on screen to fix
    // it — now it opens the picker, which is the only place a credential can be set.
    const runTest = screen.getByRole('button', { name: /Run Test/ });
    expect(runTest).toHaveProperty('disabled', false);
    fireEvent.click(runTest);
    // 판정과 건수를 배너 한 줄이 함께 진다 — row2 하나가 미선택.
    expect((await screen.findByText(/DB Credential 미선택/)).textContent).toContain('1건');
  });
});
