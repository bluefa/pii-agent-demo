/**
 * Step 2 sources its table from approval-requests/latest.resources. This guards
 * the mock/contract shape: the resources array must carry the fields the Step-2
 * table renders (resource_name, metadata.region, metadata.database_type) and must
 * NOT emit a top-level database_type (swagger declares it under metadata only).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/bff/mock/confirm';
import { getStore } from '@/lib/mock-store';
import { setCurrentUser } from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type { Project, MockResource } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const TS_ID = 9998;
const PROJ_ID = 'test-latest-resources';

const resource = (id: string, overrides?: Partial<MockResource>): MockResource => ({
  id,
  type: 'RDS',
  resourceId: `rds-${id}`,
  databaseType: 'MYSQL',
  connectionStatus: 'PENDING',
  isSelected: true,
  integrationCategory: 'TARGET',
  ...overrides,
});

const makeProject = (): Project => ({
  id: PROJ_ID,
  targetSourceId: TS_ID,
  projectCode: 'T',
  name: 'T',
  description: 'T',
  serviceCode: 'S',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  status: {
    ...createInitialProjectStatus(),
    scan: { status: 'COMPLETED' },
    targets: { confirmed: true, selectedCount: 1, excludedCount: 1 },
    approval: { status: 'PENDING' },
  },
  resources: [
    resource('a'),
    resource('b', {
      isSelected: false,
      exclusion: { reason: 'StageDB', excludedAt: '2026-01-01T00:00:00Z', excludedBy: { id: 'admin-1', name: 'admin' } },
    }),
  ],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  isRejected: false,
});

describe('mock getApprovalRequestLatest — resources carry Step-2 table fields', () => {
  beforeEach(() => {
    const store = getStore();
    store.projects = store.projects.filter((p) => p.id !== PROJ_ID);
    store.projectHistory = [];
    store.currentUserId = 'admin-1';
    setCurrentUser('admin-1');
    _resetApprovedIntegrationStore();
    store.projects.push(makeProject());
  });

  it('every resource has resource_name + metadata.region + metadata.database_type, split by selected', async () => {
    const response = await mockConfirm.getApprovalRequestLatest(String(TS_ID));
    const body = await response.json();

    expect(Array.isArray(body.resources)).toBe(true);
    expect(body.resources.length).toBe(2);

    for (const r of body.resources) {
      expect(typeof r.resource_name).toBe('string');
      expect(r.resource_name.length).toBeGreaterThan(0);
      expect(typeof r.metadata?.region).toBe('string');
      expect(r.metadata.region.length).toBeGreaterThan(0);
      expect(typeof r.metadata?.database_type).toBe('string');
      expect(typeof r.selected).toBe('boolean');
      // swagger TargetSourceResourceItemDto declares database_type under metadata only.
      expect(r.database_type).toBeUndefined();
    }

    const excluded = body.resources.find((r: { selected: boolean }) => !r.selected);
    expect(excluded?.exclusion_reason).toBe('StageDB');
  });

  /**
   * The mirror of the above, and the reason it matters: an IDC resource has NEITHER of
   * those. No scan names an on-prem DB (its address is its identity) and it sits in no
   * region. The mock used to synthesise both anyway, so `sea-analytics-prod` /
   * `ap-northeast-1` reached every admin screen that prints them and read as real values —
   * a wrong answer is worse than a blank, because nothing on the screen says it is wrong.
   */
  it('gives an IDC resource no synthesised resource_name and no region', async () => {
    const store = getStore();
    store.projects = store.projects.filter((p) => p.id !== PROJ_ID);
    store.projects.push({
      ...makeProject(),
      cloudProvider: 'IDC',
      resources: [
        resource('idc-a', {
          type: 'IDC_RESOURCE',
          resourceId: 'idc-r-1',
          idcConfig: {
            inputFormat: 'IP',
            ips: ['10.20.4.11'],
            domain: '',
            sourceIps: ['10.20.9.11'],
            firewallOpen: true,
          },
        }),
      ],
    });

    const response = await mockConfirm.getApprovalRequestLatest(String(TS_ID));
    const body = await response.json();

    const [row] = body.resources;
    expect(row.resource_name).toBeUndefined();
    expect(row.metadata.region).toBeUndefined();
    // The facts it DOES have still ride, or the row would have no identity at all.
    expect(row.metadata.idc_ips).toEqual(['10.20.4.11']);
    expect(row.metadata.idc_host_format).toBe('IP');
  });
});
