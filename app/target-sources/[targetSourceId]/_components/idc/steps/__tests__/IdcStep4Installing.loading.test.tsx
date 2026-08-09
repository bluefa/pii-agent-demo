// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import type { UseIdcInstallationStatusResult } from '@/app/hooks/useIdcInstallationStatus';
import type { IdcResourceInstallView, IdcResourceView } from '@/app/lib/api/idc';

let installStatus: UseIdcInstallationStatusResult;
let confirmedResources: Promise<IdcResourceView[]>;

vi.mock('@/app/hooks/useIdcInstallationStatus', () => ({
  useIdcInstallationStatus: () => installStatus,
}));

vi.mock('@/app/lib/api/idc', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/app/lib/api/idc')>();
  return { ...mod, getIdcConfirmedResources: () => confirmedResources };
});

vi.mock('@/app/target-sources/[targetSourceId]/_components/common', async (importOriginal) => {
  const mod = await importOriginal<
    typeof import('@/app/target-sources/[targetSourceId]/_components/common')
  >();
  return { ...mod, ProjectPageMeta: () => null, RejectionAlert: () => null };
});

import { IdcStep4Installing } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep4Installing';

const project: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'idc-proj-1023',
  targetSourceId: 1023,
  projectCode: 'IDC-023',
  serviceCode: 'idc',
  serviceName: 'IDC',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'IDC PII Agent',
  description: '',
  isRejected: false,
  cloudProvider: 'IDC',
};

const identity: ProjectIdentity = { cloudProvider: 'IDC', identifiers: [] };

const renderStep = () =>
  render(
    <IdcStep4Installing
      project={project}
      identity={identity}
      providerLabel="IDC"
      onProjectUpdate={() => {}}
    />,
  );

const settled: UseIdcInstallationStatusResult = {
  status: { resources: [] },
  loading: false,
  refreshing: false,
  error: null,
  refresh: async () => {},
};

/**
 * The empty install list is indistinguishable from "not loaded yet" once it
 * reaches InstallStatusDetail: it aggregates to 전체 0 / 대기 0-0 and — because
 * the 방화벽 step carries a static serviceAction — raises the "지금 서비스 측에서
 * 확인이 필요합니다" banner. Neither may appear before both fetches settle.
 */
const FALSE_CLAIMS = ['전체 리소스', '지금 서비스 측에서 확인이 필요합니다'];

const installed: IdcResourceInstallView = {
  resourceId: 'idc-res-1',
  installationStatus: 'IN_PROGRESS',
  cxTerraform: { status: 'COMPLETED' },
  bdpTerraform: { status: 'IN_PROGRESS' },
  firewallCheck: { status: 'UNKNOWN' },
};

describe('IdcStep4Installing loading gate', () => {
  beforeEach(() => {
    confirmedResources = new Promise(() => {}); // never settles
  });

  it('opens once both fetches settle', async () => {
    confirmedResources = Promise.resolve([]);
    installStatus = { ...settled, status: { resources: [installed] } };
    const { container } = renderStep();

    // The gate is three conditions deep; without this the whole component could
    // regress to a permanent skeleton and every other case here would still pass.
    expect(await screen.findByText('전체 리소스')).toBeTruthy();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('keeps the skeleton while a retry is in flight', async () => {
    confirmedResources = Promise.resolve([]);
    // refresh() sets `refreshing`, never `loading`, and leaves status null. Gating
    // on `loading` would drop the user straight back onto the 0-resource card the
    // retry button exists to escape.
    installStatus = { ...settled, status: null, refreshing: true };
    const { container } = renderStep();

    await screen.findByLabelText('IDC 설치 상태 확인 중');
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    for (const claim of FALSE_CLAIMS) expect(screen.queryByText(claim)).toBeNull();
  });

  it('holds the skeleton while the installation status loads', () => {
    installStatus = { ...settled, status: null, loading: true };
    const { container } = renderStep();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    for (const claim of FALSE_CLAIMS) expect(screen.queryByText(claim)).toBeNull();
  });

  it('holds the skeleton while the confirmed rows load, even after the status lands', () => {
    installStatus = settled;
    const { container } = renderStep();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    for (const claim of FALSE_CLAIMS) expect(screen.queryByText(claim)).toBeNull();
  });

  it('shows a retry instead of an empty install table when the status fetch fails', () => {
    installStatus = { ...settled, status: null, error: '상태 조회 실패' };
    renderStep();

    expect(screen.getByText('상태 조회 실패')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });
});
