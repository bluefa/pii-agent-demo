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
  isTerraformExecutionGranted: false,
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

  it('reads the stored credential in the row and opens the picker on it', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    // 값은 행에서 읽는다 — 무엇이 걸려 있는지 보려고 모달을 열 필요가 없다.
    const trigger = screen.getByRole('button', { name: /10\.20\.30\.40 Credential 수정 — 현재 idc_svc_mysql/ });
    fireEvent.click(trigger);
    // 대상은 IDC 가 부르는 이름(접속 주소)으로 적힌다 — ARN 을 쓰는 클라우드와 라벨이 다르다.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('접속 주소')).toBeTruthy();
    expect(within(dialog).getByText('10.20.30.40:3306')).toBeTruthy();
  });

  it('shows the idle summary card (nothing connected yet)', async () => {
    renderStep();

    expect(
      await screen.findByText('연결 테스트 대기 중 — Run Test를 실행해 주세요'),
    ).toBeTruthy();
    // No run yet: the summary carries no run meta and no % (pct only renders while
    // a run is in flight — an idle screen has nothing to be a percentage OF).
    expect(screen.queryByText(/^실행 #/)).toBeNull();
  });

  it('blocks Run Test while a live row lacks a credential, and says so above the table', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    // Row2 has no credential. The warning line names the count and the row's own cell is
    // where it gets fixed — Run Test does not detour through a bulk dialog.
    expect((await screen.findByText(/Credential 미설정/)).textContent).toContain('1건');
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '미설정만 보기' })).toBeTruthy();
  });
});
