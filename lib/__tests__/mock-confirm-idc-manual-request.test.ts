import { beforeEach, describe, expect, it } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/bff/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus, type Project } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const TEST_PROJECT_ID = 'test-idc-manual-request';
const TEST_TARGET_SOURCE_ID = 9998;
const TEST_TARGET_SOURCE_ID_STR = String(TEST_TARGET_SOURCE_ID);

/** IDC has no scan, so a step-1 project starts with NO resources at all. */
const createTestProject = (): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: TEST_TARGET_SOURCE_ID,
  projectCode: 'IDC-998',
  name: 'IDC manual input',
  description: 'IDC',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'IDC',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  resources: [],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: '2026-03-23T00:00:00Z',
  updatedAt: '2026-03-23T00:00:00Z',
  isRejected: false,
});

const request = {
  resources: [
    {
      resource_id: 'idc-tmp-0',
      selected: true,
      metadata: {
        provider: 'IDC',
        idc_host_format: 'IP',
        idc_ips: ['10.9.9.9'],
        port: 3307,
        database_type: 'mysql',
      },
    },
    {
      resource_id: 'idc-tmp-1',
      selected: false,
      exclusion_reason: '스테이지 DB',
      metadata: {
        provider: 'IDC',
        idc_host_format: 'HOST',
        idc_host: 'stage.svc.io',
        port: 5432,
        database_type: 'postgresql',
      },
    },
  ],
};

/**
 * Step 1 is manual entry held in component state, so the approval request is the first time the
 * backend hears about these rows — their ids match nothing in `project.resources`. The request
 * used to be dropped on the floor, and since every later read derives from that list, steps 2·3
 * came up empty for a target seeded without resources.
 */
describe('mockConfirm.createApprovalRequest — IDC manual rows', () => {
  beforeEach(() => {
    const store = getStore();
    store.projects = store.projects.filter((project) => project.id !== TEST_PROJECT_ID);
    store.projectHistory = [];
    store.currentUserId = 'admin-1';
    setCurrentUser('admin-1');
    _resetApprovedIntegrationStore();
    store.projects.push(createTestProject());
  });

  it('persists rows the project did not have, excluded ones included', async () => {
    const response = await mockConfirm.createApprovalRequest(TEST_TARGET_SOURCE_ID_STR, request);
    expect(response.status).toBe(200);

    const latest = await mockConfirm.getApprovalRequestLatest(TEST_TARGET_SOURCE_ID_STR);
    const body = await latest.json();

    expect(body.resources).toHaveLength(2);

    const target = body.resources.find((r: { resource_id: string }) => r.resource_id === 'idc-tmp-0');
    expect(target.selected).toBe(true);
    // The port the user typed survives — not the conventional 3306 for MySQL.
    expect(target.metadata).toMatchObject({ port: 3307, idc_ips: ['10.9.9.9'], idc_host_format: 'IP' });

    const excluded = body.resources.find((r: { resource_id: string }) => r.resource_id === 'idc-tmp-1');
    expect(excluded.selected).toBe(false);
    expect(excluded.exclusion_reason).toBe('스테이지 DB');
    expect(excluded.metadata).toMatchObject({ port: 5432, idc_host: 'stage.svc.io', idc_host_format: 'HOST' });
  });
});
