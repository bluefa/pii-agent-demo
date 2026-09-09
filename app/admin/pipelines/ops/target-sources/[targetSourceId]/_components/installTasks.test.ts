import { describe, expect, it } from 'vitest';
import { buildInstallTasks } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installTasks';
import type { InstallPendingInput } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type { InstallDetailResource, InstallStepValue } from '@/app/components/features/process-status/install-status-detail/model';

const resource = (id: string, cells: Record<string, InstallStepValue>): InstallDetailResource => ({
  resourceId: id, resourceName: id, rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(Object.entries(cells).map(([key, status]) => [key, { status, guide: null }])),
});
const tasks = (provider: string, cells: Record<string, InstallStepValue>, manualInstall = false) =>
  buildInstallTasks({ provider, manualInstall, detail: {
    lastCheck: { status: 'SUCCESS' }, unavailable: false, resources: [resource('db-1', cells)],
  } });

describe('installation task ownership and prerequisites', () => {
  it('assigns AWS auto service-account Terraform to BDC', () => {
    const result = tasks('aws', { service: 'IN_PROGRESS', bdcCommon: 'BDC_INSTALL_REQUIRED', bdcService: 'BDC_INSTALL_REQUIRED' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ owner: 'bdc', state: 'needed', title: 'AWS 자동 설치' });
  });

  it('waits for the service owner in AWS manual mode', () => {
    const result = tasks('aws', { service: 'IN_PROGRESS', bdcCommon: 'BDC_INSTALL_REQUIRED', bdcService: 'BDC_INSTALL_REQUIRED' }, true);
    expect(result.map(task => [task.owner, task.state])).toEqual([['service', 'needed'], ['bdc', 'waiting']]);
    expect(result[1].label).toBe('서비스 작업 대기');
  });

  it('hands manual AWS installation over to BDC after service Terraform is complete', () => {
    const result = tasks('aws', { service: 'COMPLETED', bdcCommon: 'BDC_INSTALL_REQUIRED' }, true);
    expect(result.map(task => task.state)).toEqual(['done', 'needed']);
  });

  it('shows the AWS account permission prerequisite separately from resource work', () => {
    const detail: InstallPendingInput['detail'] = {
      lastCheck: { status: 'SUCCESS' }, unavailable: false,
      roleVerify: { status: 'FAIL', guide: null },
      resources: [resource('db-1', { service: 'IN_PROGRESS' })],
    };
    const result = buildInstallTasks({ provider: 'aws', manualInstall: false, detail });
    expect(result[0]).toMatchObject({ id: 'permission', owner: 'service', state: 'check' });
    expect(result[1].state).toBe('waiting');
    expect(buildInstallTasks({ provider: 'aws', manualInstall: true, detail }).some(task => task.id === 'permission')).toBe(false);
  });

  it('allows IDC firewall registration alongside BDC installation', () => {
    const result = tasks('idc', { cx: 'IN_PROGRESS', bdp: 'BDC_INSTALL_REQUIRED', firewall: 'IN_PROGRESS' });
    expect(result.map(task => [task.owner, task.state])).toEqual([['bdc', 'needed'], ['service', 'needed']]);
    expect(result[1].description).toContain('병행');
  });

  it('distinguishes IDC access-check waiting from firewall registration', () => {
    const result = tasks('idc', { cx: 'IN_PROGRESS', firewall: 'BDC_INSTALL_REQUIRED' });
    expect(result[1]).toMatchObject({ state: 'waiting', label: 'BDC 작업 대기' });
    expect(result[1].description).toContain('미리 진행');
  });

  it('omits Azure VM work for non-VM resources and waits to offer PE approval', () => {
    const result = tasks('azure', { vmSubnet: 'SKIP', vmApply: 'SKIP', bdc: 'IN_PROGRESS', pe: 'BDC_INSTALL_REQUIRED' });
    expect(result.map(task => task.id)).toEqual(['bdc', 'pe']);
    expect(result[1]).toMatchObject({ state: 'waiting', label: 'BDC 작업 대기' });
  });

  it('requires Azure VM preparation before BDC installation', () => {
    const result = tasks('azure', { vmSubnet: 'IN_PROGRESS', vmApply: 'IN_PROGRESS', bdc: 'BDC_INSTALL_REQUIRED', pe: 'BDC_INSTALL_REQUIRED' });
    expect(result.map(task => task.state)).toEqual(['needed', 'waiting', 'waiting']);
  });

  it('offers Azure approval only after the BDC request is ready', () => {
    const result = tasks('azure', { vmSubnet: 'SKIP', vmApply: 'SKIP', bdc: 'COMPLETED', pe: 'IN_PROGRESS' });
    expect(result[1]).toMatchObject({ owner: 'service', state: 'needed' });
  });

  it.each(['FAIL', 'UNKNOWN'] as const)('routes Azure PE %s to BDC for investigation', status => {
    const result = tasks('azure', { vmSubnet: 'SKIP', vmApply: 'SKIP', bdc: 'COMPLETED', pe: status });
    expect(result.find(task => task.id === 'pe')).toBeUndefined();
    expect(result.find(task => task.id === 'peReview')).toMatchObject({ owner: 'bdc', state: 'check' });
  });

  it('assigns only GCP Subnet preparation to the service owner', () => {
    const result = tasks('gcp', { subnet: 'IN_PROGRESS', service: 'BDC_INSTALL_REQUIRED', bdc: 'BDC_INSTALL_REQUIRED' });
    expect(result.map(task => [task.owner, task.state])).toEqual([['service', 'needed'], ['bdc', 'waiting']]);
    expect(tasks('gcp', { subnet: 'SKIP', service: 'IN_PROGRESS', bdc: 'BDC_INSTALL_REQUIRED' })[0]).toMatchObject({ owner: 'bdc', state: 'needed' });
  });

  it('does not block a ready resource because another resource has pending prerequisites', () => {
    const result = buildInstallTasks({ provider: 'aws', manualInstall: true, detail: {
      lastCheck: { status: 'SUCCESS' }, unavailable: false, resources: [
        resource('ready', { service: 'COMPLETED', bdcCommon: 'IN_PROGRESS' }),
        resource('waiting', { service: 'IN_PROGRESS', bdcCommon: 'BDC_INSTALL_REQUIRED' }),
      ],
    } });
    expect(result.find(task => task.id === 'bdc')?.state).toBe('needed');
  });

  it('does not interpret UNKNOWN or FAIL as a job actively running', () => {
    const result = tasks('gcp', { subnet: 'COMPLETED', service: 'UNKNOWN', bdc: 'FAIL' });
    expect(result[1]).toMatchObject({ state: 'check', label: '상태 확인 필요' });
  });

  it('does not invent tasks from an unavailable or failed check', () => {
    for (const detail of [null, { lastCheck: { status: 'FAILED' as const }, unavailable: false, resources: [resource('db', { service: 'IN_PROGRESS' })] }]) {
      expect(buildInstallTasks({ provider: 'aws', manualInstall: true, detail })).toEqual([]);
    }
  });
});
