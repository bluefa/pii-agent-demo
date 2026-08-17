// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
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

/** The internal NLB key — the one string this screen must never print. */
const NLB_KEY = 'idc-res-multi-1';

const confirmed: IdcResourceView = {
  resourceId: NLB_KEY,
  persisted: true,
  kind: 'MULTIPLE_IP',
  hosts: ['10.20.31.10', '10.20.31.11'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: ['10.10.0.21'],
  firewallOpen: false,
  connection: 'PENDING',
  health: null,
  done: null,
  excluded: false,
};

const installed: IdcResourceInstallView = {
  resourceId: NLB_KEY,
  installationStatus: 'IN_PROGRESS',
  cxTerraform: { status: 'COMPLETED' },
  bdpTerraform: { status: 'IN_PROGRESS' },
  firewallCheck: { status: 'UNKNOWN' },
};

const renderStep = () =>
  render(
    <IdcStep4Installing
      project={project}
      identity={identity}
      providerLabel="IDC"
      onProjectUpdate={() => {}}
    />,
  );

/**
 * IDC 행의 정체성은 BDC측 출발지 · 접속 주소(구분 포함) · Port · Database Type 이다 —
 * 스캔이 붙인 이름이 없고, resource_id 는 내부 NLB 키라 화면에 나가지 않는다
 * (design-spec §8). 표는 steps 2·3 이 쓰는 그 셀들을 그대로 쓴다.
 */
describe('IdcStep4Installing 정체성 열', () => {
  beforeEach(() => {
    confirmedResources = Promise.resolve([confirmed]);
    installStatus = {
      status: { resources: [installed] },
      loading: false,
      refreshing: false,
      error: null,
      refresh: async () => {},
    };
  });

  it('IDC 열로 행을 식별하고 resource_id 는 어디에도 쓰지 않는다', async () => {
    const { container } = renderStep();

    // 첫 열은 이 단계의 주어인 출발지다 — 그 옆이 도착지라 한 행이 한 경로로 읽힌다.
    expect(await screen.findByRole('columnheader', { name: /BDC측 출발지/ })).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers[0]).toContain('BDC측 출발지');
    expect(headers[1]).toBe('접속 주소');
    // 구분은 제 열을 갖지 않는다 — 접속 주소 위에 붙는다.
    expect(headers).not.toContain('구분');
    expect(headers).not.toContain('Resource ID');
    expect(headers).not.toContain('Resource Name');
    for (const label of ['Port', 'Database Type']) expect(headers).toContain(label);
    // 헤더만 지우고 셀이 남으면 키가 그대로 새어 나간다 — 문서 전체로 확인한다.
    expect(container.textContent).not.toContain(NLB_KEY);

    // 열마다 값이 실제로 도착하는지 — 헤더만 서고 칸이 비면 이 표는 거짓말을 한다.
    expect(screen.getByText('10.10.0.21')).toBeTruthy();
    // IP 행에는 태그가 없다 — 값이 이미 자기 종류를 말한다.
    expect(screen.queryByText('IP')).toBeNull();
    expect(screen.getByText('10.20.31.10')).toBeTruthy();
    expect(screen.getByText('3306')).toBeTruthy();
    expect(screen.getByText('MySQL')).toBeTruthy();
  });

  it('나머지 IP 는 더보기로 펼친다', async () => {
    renderStep();

    const more = await screen.findByRole('button', { name: 'IP 1개 더보기 ▾' });
    expect(screen.queryByText('10.20.31.11')).toBeNull();

    fireEvent.click(more);
    expect(screen.getByText('10.20.31.11')).toBeTruthy();
  });

  it('첫 IP 가 아닌 IP 로도 검색된다', async () => {
    renderStep();

    const search = await screen.findByPlaceholderText('Host 또는 IP 검색');
    fireEvent.change(search, { target: { value: '31.11' } });

    // 검색 건초더미가 hosts[0] 뿐이면 이 행은 필터에서 사라진다.
    expect(screen.getByText('10.20.31.10')).toBeTruthy();
  });
});
